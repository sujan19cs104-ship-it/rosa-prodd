# Runs the ROSAE calendar sync once
param(
  [string]$ProjectRoot = "c:\Users\sujan\Downloads\sa\rosae"
)

Set-Location $ProjectRoot
# Ensure Node modules are installed (optional: comment out after first run)
# if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) { npm ci }

npm run sync:calendar