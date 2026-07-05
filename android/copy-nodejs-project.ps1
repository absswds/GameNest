# Copies the Node.js game project into the Android app's assets folder.
# Run this from PowerShell whenever you modify server.js, games/, bots/, public/, etc.
#
# Usage:
#   cd D:\binbi\Documents\Code\project\game\android
#   .\copy-nodejs-project.ps1

$ErrorActionPreference = "Stop"

# Anchor the source on this script's own location (the android/ folder),
# so it works no matter what the current working directory is.
$src  = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dest = "$PSScriptRoot\app\src\main\assets\nodejs-project"

Write-Host ""
Write-Host "Source: $src"
Write-Host "Dest:   $dest"
Write-Host ""

# Clean destination first
if (Test-Path $dest) {
    Write-Host "Removing existing nodejs-project..."
    Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force $dest | Out-Null

# Files and folders to copy
$items = @(
    "server.js",
    "main.js",
    "startup-port.js",
    "package.json",
    "package-lock.json",
    "games",
    "bots",
    "public",
    "node_modules"
)

foreach ($item in $items) {
    $srcPath = Join-Path $src $item
    if (Test-Path $srcPath) {
        Write-Host "Copying $item..."
        Copy-Item -Recurse -Force $srcPath $dest
    } else {
        Write-Host "  Skipping $item (not found)" -ForegroundColor Yellow
    }
}

# Remove dev/test files inside node_modules to shrink APK size
$cleanupPatterns = @(
    "*.md", "*.markdown", "README*", "CHANGELOG*", "HISTORY*",
    "LICENSE*", "*.yml", "*.yaml", ".npmignore", ".eslintrc*",
    ".prettierrc*", ".github", ".vscode", "test", "tests",
    "example", "examples", "docs", "doc", "benchmark", "benchmarks",
    "*.min.js.map", "*.d.ts"
)

$nodeModules = Join-Path $dest "node_modules"
if (Test-Path $nodeModules) {
    Write-Host ""
    Write-Host "Cleaning node_modules to reduce APK size..."
    foreach ($pattern in $cleanupPatterns) {
        Get-ChildItem -Path $nodeModules -Recurse -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
        }
    }
}

# Report final size
$size = (Get-ChildItem -Path $dest -Recurse | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($size / 1MB, 2)
Write-Host ""
Write-Host "Done. nodejs-project size: $sizeMB MB" -ForegroundColor Green
Write-Host ""
