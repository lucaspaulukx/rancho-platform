[CmdletBinding()]
param([switch]$PlanOnly, [switch]$ClassicOnly)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if ($PlanOnly) {
    [ordered]@{
        action = 'local-laboratory-bootstrap'
        sourceModified = $false
        startsContainers = $false
        preservesExistingCredentialsAndRealm = $true
        services = $(if ($ClassicOnly) { @('rancher','keycloak') } else { @('rancher','keycloak','console') })
        createsMissingPrivateEnv = -not (Test-Path -LiteralPath '.env')
        createsMissingRealm = -not (Test-Path -LiteralPath 'keycloak/realm.json')
    } | ConvertTo-Json -Depth 4
    exit 0
}
python scripts/upstream.py apply
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar a fonte oficial fixada; alteracoes existentes preservadas.' }
python ensure-lab-network.py
if ($LASTEXITCODE -ne 0) { throw 'Rede incompativel; nenhuma rede existente foi removida.' }
if (-not (Test-Path -LiteralPath '.env')) {
    function New-LabPassword { [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) }
    $lines = @(
        "OIDC_CLIENT_SECRET=$(New-LabPassword)"
        "KEYCLOAK_ADMIN_PASSWORD=$(New-LabPassword)"
        "RANCHER_ADMIN_PASSWORD=$(New-LabPassword)"
        "LAB_USER_PASSWORD=$(New-LabPassword)"
    )
    [IO.File]::WriteAllLines((Join-Path $PSScriptRoot '.env'), $lines)
}
$labConfig = @{}
Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object { $key,$value = $_ -split '=',2; $labConfig[$key]=$value }
foreach ($name in @('OIDC_CLIENT_SECRET','KEYCLOAK_ADMIN_PASSWORD','RANCHER_ADMIN_PASSWORD','LAB_USER_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace($labConfig[$name])) { throw "Variavel obrigatoria ausente em .env: $name. O arquivo existente nao foi alterado." }
}
New-Item -ItemType Directory -Force keycloak | Out-Null
if (-not (Test-Path -LiteralPath 'keycloak/realm.json')) {
    Copy-Item -LiteralPath 'keycloak/realm.template.json' -Destination 'keycloak/realm.json'
}
docker volume create rancher16-rbac-lab-db | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar volume do laboratorio.' }
$composeArguments = @('compose','-f','compose.yaml')
if (-not $ClassicOnly) { $composeArguments += @('-f','compose.console.yaml') }
& docker @composeArguments up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o laboratorio.' }
Write-Host 'Console: http://localhost:18090/console/ | Rancher: http://localhost:18080 | Keycloak: http://localhost:18081'
Write-Host 'Credenciais descartaveis em .env. Execute tests/integration.py para inicializar e validar o primeiro laboratorio.'
