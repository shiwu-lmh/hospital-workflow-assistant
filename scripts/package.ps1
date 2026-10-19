$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$extensionDir = Join-Path $projectDir 'extension'
$distDir = Join-Path $projectDir 'dist'
$outputDir = Join-Path $distDir 'unpacked'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Copy-Item -Path (Join-Path $extensionDir '*') -Destination $outputDir -Recurse -Force
Write-Output $outputDir
