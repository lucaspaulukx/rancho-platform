$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sourceContainer = 'rancher16-rbac-lab'
$identifier = [Guid]::NewGuid().ToString('N')
$restoreContainer = "rancher16-restore-$identifier"
$restoreVolume = "rancher16-restore-$identifier"
$backupPath = Join-Path ([IO.Path]::GetTempPath()) "rancher16-cattle-$identifier.dpapi"
$checks = [Collections.Generic.List[object]]::new()
$volumeCreated = $false
$containerCreated = $false
$stage = 'snapshot preconditions'
$previousOutputEncoding = $OutputEncoding
$previousConsoleEncoding = [Console]::OutputEncoding
$utf8 = [Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Invoke-PrivateDocker {
    param([string[]]$DockerArguments, [string]$InputText)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if ($PSBoundParameters.ContainsKey('InputText')) {
            $lines = @($InputText | & docker @DockerArguments 2>&1)
        } else {
            $lines = @(& docker @DockerArguments 2>&1)
        }
        $status = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($status -ne 0) { throw 'Local Docker operation failed; sensitive output withheld.' }
    return ($lines -join "`n")
}

function Confirm-Check {
    param([string]$Name, [bool]$Condition)
    if (-not $Condition) { throw $Name }
    $checks.Add(@{ check = $Name; status = 'passed' })
    Write-Host "PASS: $Name"
}

function Read-DatabaseValue {
    param([string]$Container, [string]$Sql)
    return Invoke-PrivateDocker -DockerArguments @('exec', $Container, 'mysql', '--user=root', '--batch', '--skip-column-names', '-e', $Sql)
}

try {
    $engines = Read-DatabaseValue $sourceContainer "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle' AND ENGINE <> 'InnoDB';"
    Confirm-Check 'online snapshot precondition: every Cattle table uses InnoDB' ($engines.Trim() -eq '0')
    $tableCount = Read-DatabaseValue $sourceContainer "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle';"
    $accounts = Read-DatabaseValue $sourceContainer 'SELECT COUNT(*) FROM cattle.account;'
    $checksumSql = 'CHECKSUM TABLE cattle.local_rbac_group, cattle.local_rbac_member, cattle.local_rbac_grant, cattle.local_rbac_audit, cattle.local_rbac_audit_detail, cattle.local_rbac_oidc_user EXTENDED;'
    $before = Read-DatabaseValue $sourceContainer $checksumSql
    Confirm-Check 'all six local RBAC OIDC audit checksums are available' (@($before -split "`n").Count -eq 6 -and $before -notmatch '\bNULL\b')
    $dump = Invoke-PrivateDocker -DockerArguments @('exec', $sourceContainer, 'mysqldump', '--user=root', '--single-transaction', '--skip-lock-tables', '--skip-add-locks', '--routines', '--events', '--triggers', '--hex-blob', '--default-character-set=utf8mb4', '--databases', 'cattle')
    Add-Type -AssemblyName System.Security
    $plainBytes = $utf8.GetBytes($dump)
    $encrypted = [Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($backupPath, $encrypted)
    [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    $plainBytes = $null
    $dump = $null
    $recovered = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($backupPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $sql = $utf8.GetString($recovered)
    [Array]::Clear($recovered, 0, $recovered.Length)
    $recovered = $null
    Confirm-Check 'backup is encrypted at rest and recoverable by the current Windows user' ((Get-Item -LiteralPath $backupPath).Length -gt 0 -and $sql.Length -gt 0)
    $stage = 'source image metadata'
    $image = (Invoke-PrivateDocker -DockerArguments @('inspect', '--format', '{{.Image}}', $sourceContainer)).Trim()
    $stage = 'isolated volume creation'
    $null = Invoke-PrivateDocker -DockerArguments @('volume', 'create', '--label', 'rancher16.lab.restore-test=true', $restoreVolume)
    $volumeCreated = $true
    $bootstrap = @'
set -e
mysql_install_db --user=mysql --datadir=/var/lib/mysql >/tmp/restore-init.log 2>&1
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld
exec mysqld --user=mysql --datadir=/var/lib/mysql --skip-networking --innodb-buffer-pool-size=64M --key-buffer-size=8M --max-connections=10 --log-error=/tmp/restore-mysql.log
'@
    $stage = 'isolated MySQL bootstrap'
    $bootstrap = $bootstrap.Replace("`r", '')
    $null = Invoke-PrivateDocker -DockerArguments @('run', '-d', '--name', $restoreContainer, '--network', 'none', '--memory', '512m', '--mount', "type=volume,source=$restoreVolume,target=/var/lib/mysql,volume-nocopy", '--entrypoint', '/bin/sh', $image, '-c', $bootstrap)
    $containerCreated = $true
    $stage = 'isolated MySQL readiness'
    $null = Invoke-PrivateDocker -DockerArguments @('exec', $restoreContainer, 'mysqladmin', '--user=root', '--wait=15', 'ping')
    $network = (Invoke-PrivateDocker -DockerArguments @('inspect', '--format', '{{.HostConfig.NetworkMode}}', $restoreContainer)).Trim()
    Confirm-Check 'restore MySQL is isolated with no network' ($network -eq 'none')
    $stage = 'database restore'
    $null = Invoke-PrivateDocker -DockerArguments @('exec', '-i', $restoreContainer, 'mysql', '--user=root', '--default-character-set=utf8mb4') -InputText $sql
    $sql = $null
    $stage = 'restored content verification'
    $restoredCount = Read-DatabaseValue $restoreContainer "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle';"
    $restoredAccounts = Read-DatabaseValue $restoreContainer 'SELECT COUNT(*) FROM cattle.account;'
    Confirm-Check 'restore preserves all Cattle tables and account count' ($tableCount.Trim() -eq $restoredCount.Trim() -and $accounts.Trim() -eq $restoredAccounts.Trim())
    $after = Read-DatabaseValue $restoreContainer $checksumSql
    Confirm-Check 'restore preserves exact group member grant audit and OIDC mapping contents' ($before -eq $after)
    $current = Read-DatabaseValue $sourceContainer $checksumSql
    Confirm-Check 'source RBAC OIDC audit contents remain unchanged after restore drill' ($before -eq $current)
} catch {
    $checks.Add(@{ check = $stage; status = 'failed'; errorType = $_.Exception.GetType().Name })
    Write-Host "FAILED: $stage; sensitive output withheld."
} finally {
    $dump = $null
    $sql = $null
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
    if ($recovered) { [Array]::Clear($recovered, 0, $recovered.Length) }
    try {
        if ($containerCreated) { $null = Invoke-PrivateDocker -DockerArguments @('rm', '--force', $restoreContainer) }
        if ($volumeCreated) { $null = Invoke-PrivateDocker -DockerArguments @('volume', 'rm', $restoreVolume) }
    } catch {
        $checks.Add(@{ check = 'isolated restore cleanup'; status = 'failed' })
        Write-Host 'FAILED: isolated restore cleanup.'
    }
    $OutputEncoding = $previousOutputEncoding
    [Console]::OutputEncoding = $previousConsoleEncoding
    $report = @{ checks = @($checks.ToArray()); total = $checks.Count; encryptedBackup = $backupPath; scope = 'Cattle database only; not Rancher state or Keycloak' }
    [IO.File]::WriteAllText((Join-Path $root 'backup-restore-test-results.json'), ($report | ConvertTo-Json -Depth 8), $utf8)
}
if (@($checks | Where-Object { $_.status -ne 'passed' }).Count) { exit 1 }
Write-Host "$($checks.Count) isolated database recovery checks passed. Encrypted backup retained outside workspace."