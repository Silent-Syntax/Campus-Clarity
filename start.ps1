$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

$port = 5500
$url = "http://localhost:$port/"

try {
  Start-Process $url | Out-Null
} catch {
  Write-Warning "Could not open browser automatically. Open: $url"
}

Write-Host "Starting server on $url"
Write-Host "Keep this window open while using the app."
Write-Host ""

python -m http.server $port

