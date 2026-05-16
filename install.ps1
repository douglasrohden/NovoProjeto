# Delega para web/ (docker compose up -d)
param(
    [switch]$Production
)

$ErrorActionPreference = "Stop"
$args = @()
if ($Production) { $args += "-Production" }
& (Join-Path $PSScriptRoot "web\install.ps1") @args
