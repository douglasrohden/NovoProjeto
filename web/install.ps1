# Sobe a stack completa (Windows PowerShell)
param(
    [switch]$Production
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example"
}

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
