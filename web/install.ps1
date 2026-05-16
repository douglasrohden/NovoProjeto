# Sobe toda a stack com um único comando (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example"
}

docker compose up -d --build

$port = if ($env:API_PORT) { $env:API_PORT } else { "3000" }
Write-Host ""
Write-Host "Stack iniciada."
Write-Host "  App:    http://localhost:$port"
Write-Host "  Health: http://localhost:$port/api/health"
Write-Host ""
Write-Host "Logs: docker compose logs -f web worker"
