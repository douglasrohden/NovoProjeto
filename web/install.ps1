# Build da imagem + sobe a stack (Windows PowerShell)
param(
    [switch]$Production
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example"
}

$image = if ($env:APP_IMAGE) { $env:APP_IMAGE } else { "document-platform:latest" }
if (Test-Path .env) {
    $line = Get-Content .env | Where-Object { $_ -match '^\s*APP_IMAGE=' } | Select-Object -First 1
    if ($line -match 'APP_IMAGE=(.+)') { $image = $Matches[1].Trim() }
}

Write-Host "Building image $image ..."
docker build -t $image .

$composeArgs = @("compose", "-f", "docker-compose.yml")
if ($Production) {
    $composeArgs += @("-f", "docker-compose.prod.yml")
}
$composeArgs += @("up", "-d")

& docker @composeArgs

$port = if ($env:API_PORT) { $env:API_PORT } else { "3000" }
Write-Host ""
Write-Host "Stack iniciada$(if ($Production) { ' (producao)' })."
Write-Host "  App:    http://localhost:$port"
Write-Host "  Health: http://localhost:$port/api/health"
Write-Host ""
Write-Host "Logs: docker compose logs -f web worker"
