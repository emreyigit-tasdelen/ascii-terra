# ZIP update for copies downloaded without git. Called by update.bat.
# Compares the stored commit (.version) with GitHub's main branch; when newer,
# downloads the ZIP and copies it over the game, skipping server\data (accounts, saves).
$ErrorActionPreference = 'Stop'
$repo = 'emreyigit-tasdelen/ascii-terra'
$root = Split-Path $PSScriptRoot -Parent
$verFile = Join-Path $root '.version'
try {
  Write-Host 'Checking for updates...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $h = @{ 'User-Agent' = 'ascii-terra-updater' }
  $remote = (Invoke-RestMethod "https://api.github.com/repos/$repo/commits/main" -Headers $h -TimeoutSec 10).sha
  $local = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '' }
  if ($remote -eq $local) { Write-Host 'Up to date.'; exit 0 }

  $tmp = Join-Path $env:TEMP "ascii-terra-update-$PID"
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'main.zip'
  Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip -Headers $h -TimeoutSec 60 -UseBasicParsing
  Expand-Archive $zip -DestinationPath $tmp
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  # Copy new and changed files only; nothing is deleted, server\data is excluded.
  robocopy $src.FullName $root /E /XD (Join-Path $src.FullName 'server\data') /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copy failed ($LASTEXITCODE)" }
  Set-Content $verFile $remote
  Remove-Item $tmp -Recurse -Force
  Write-Host 'Updated to the latest version.'
} catch {
  Write-Host "Update skipped: $($_.Exception.Message)"
}
exit 0
