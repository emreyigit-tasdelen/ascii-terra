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
  # Only published releases are installed, never unreleased commits on main.
  try { $remote = (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $h -TimeoutSec 10).tag_name }
  catch { if ($_.Exception.Response.StatusCode -eq 404) { Write-Host 'No release yet.'; exit 0 }; throw }
  if ($remote -notmatch '^v[0-9A-Za-z._-]+$') { throw "unexpected release tag" }
  $local = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '' }
  if ($remote -eq $local) { Write-Host "Up to date ($remote)."; exit 0 }

  $tmp = Join-Path $env:TEMP "ascii-terra-update-$PID"
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'release.zip'
  Invoke-WebRequest "https://github.com/$repo/archive/refs/tags/$remote.zip" -OutFile $zip -Headers $h -TimeoutSec 60 -UseBasicParsing
  Expand-Archive $zip -DestinationPath $tmp
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  # Copy new and changed files only; nothing is deleted, server\data is excluded.
  robocopy $src.FullName $root /E /XD (Join-Path $src.FullName 'server\data') /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copy failed ($LASTEXITCODE)" }
  # Remove files the previous update installed that are gone upstream. Only files listed in
  # our own manifest are ever deleted, so player files and server\data are never touched.
  $base = $src.FullName.Length + 1
  $new = @(Get-ChildItem $src.FullName -Recurse -File | ForEach-Object { $_.FullName.Substring($base) })
  $manFile = Join-Path $root '.files'
  if (Test-Path $manFile) {
    foreach ($f in Get-Content $manFile) {
      # Skip anything that could point outside the game folder (.., drive or rooted paths).
      if ($f -match '\.\.|:' -or [IO.Path]::IsPathRooted($f)) { continue }
      if ($f -and $new -notcontains $f -and $f -notlike 'server\data\*') {
        $p = Join-Path $root $f
        if (Test-Path $p -PathType Leaf) { Remove-Item $p -Force }
      }
    }
  }
  Set-Content $manFile $new
  Set-Content $verFile $remote
  Remove-Item $tmp -Recurse -Force
  Write-Host "Updated to $remote."
} catch {
  Write-Host "Update skipped: $($_.Exception.Message)"
}
exit 0
