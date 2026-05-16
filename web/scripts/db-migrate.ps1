# Aplica migrations Prisma (Postgres do docker-compose na porta 5433).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Criado .env a partir de .env.example"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Write-Host "A subir Postgres e Redis via Docker..."
  docker compose up -d postgres redis
  Write-Host "A aguardar Postgres (healthcheck)..."
  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep -Seconds 2
    $healthy = docker compose ps postgres 2>$null | Select-String -Pattern "healthy"
    if ($healthy) { break }
  } while ((Get-Date) -lt $deadline)
}
else {
  Write-Host "Docker nao encontrado no PATH."
  Write-Host "Use Postgres em localhost:5433 (POSTGRES_PORT no .env) ou instale Docker Desktop."
}

Write-Host "A aplicar migrations..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Falha ao ligar ao Postgres. Tente:"
  Write-Host '  - Confirmar POSTGRES_PASSWORD=change_me e DATABASE_URL com porta 5433 no .env'
  Write-Host '  - docker compose up -d postgres --force-recreate'
  Write-Host '  - docker compose down -v  (apaga dados) e depois docker compose up -d postgres'
  Write-Host '  - psql -U postgres -f scripts/create-db-user.sql  (Postgres local)'
  exit $LASTEXITCODE
}

Write-Host "Migrations aplicadas."
