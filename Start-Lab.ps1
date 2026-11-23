$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
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
Get-Content -LiteralPath '.env' | ForEach-Object { $key,$value = $_ -split '=',2; $labConfig[$key]=$value }
New-Item -ItemType Directory -Force keycloak | Out-Null
$realm = @{
    realm = 'rancher-lab'; enabled = $true; sslRequired = 'none'; registrationAllowed = $false
    clients = @(@{
        clientId = 'rancher16'; enabled = $true; protocol = 'openid-connect'; publicClient = $false
        secret = $labConfig['OIDC_CLIENT_SECRET']; standardFlowEnabled = $true; directAccessGrantsEnabled = $false
        redirectUris = @('http://localhost:18080/oidc/callback'); webOrigins = @('http://localhost:18080')
        attributes = @{ 'pkce.code.challenge.method' = 'S256' }
    })
    users = @('sem-acesso','leitor','operador') | ForEach-Object { @{
        username = $_; enabled = $true; firstName = $_; lastName = 'Laboratorio'; email = "$_@example.invalid"; emailVerified = $true
        credentials = @(@{ type = 'password'; value = $labConfig['LAB_USER_PASSWORD']; temporary = $false })
    } }
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'keycloak/realm.json'), ($realm | ConvertTo-Json -Depth 12))
docker volume create rancher16-rbac-lab-db | Out-Null
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o laboratorio.' }
Write-Host 'Rancher: http://localhost:18080 | Keycloak: http://localhost:18081'
Write-Host 'As credenciais descartaveis do laboratorio estao em .env. Execute tests/integration.py para inicializar e validar.'
