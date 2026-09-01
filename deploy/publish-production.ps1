# Copy Spin Win static files for EC2 nginx (/var/www/hms-spin).
# Usage: powershell -File "d:\HSM Software\Landing page\deploy\publish-production.ps1"

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'dist\publish'
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null
foreach ($file in @('index.html', 'app.js', 'styles.css')) {
    Copy-Item -Path (Join-Path $root $file) -Destination $outDir -Force
}
Write-Host "Spin Win publish folder: $outDir"
