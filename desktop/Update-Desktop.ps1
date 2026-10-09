# Aktualizuje existující instalaci Life Is Bitch ze zveřejněného GitHub Release.
$ErrorActionPreference = 'Stop'
$repo = 'patrikdjasnik-eng/lifeisbitch-'
$tempDir = Join-Path $env:TEMP 'LifeIsBitch-Upgrade'
New-Item -Path $tempDir -ItemType Directory -Force | Out-Null

try {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'LifeIsBitch-Upgrader'; 'Accept' = 'application/vnd.github+json' }
  $asset = @($release.assets | Where-Object { $_.name -match '^Life-Is-Bitch-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe$' }) | Select-Object -First 1
  if (-not $asset) { throw 'V poslednim vydani chybi Windows instalator.' }
  if ($asset.digest -notmatch '^sha256:([a-fA-F0-9]{64})$') { throw 'Instalator nema overitelny SHA-256 digest.' }

  $expectedHash = $Matches[1]
  $installerPath = Join-Path $tempDir $asset.name
  Write-Host "Stahuji $($asset.name)..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installerPath
  $actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
  if ($actualHash -ne $expectedHash) { throw 'Kontrola SHA-256 nesouhlasi. Instalace byla zastavena.' }

  Write-Host "SHA-256 overeno. Spoustim aktualizacni instalator..." -ForegroundColor Green
  $process = Start-Process -FilePath $installerPath -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw "Instalator skoncil s kodem $($process.ExitCode)." }

  $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Life Is Bitch.lnk'
  if (-not (Test-Path -LiteralPath $shortcutPath)) { throw 'Instalace dokoncena, ale chybi ikona na plose.' }
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
  if (-not (Test-Path -LiteralPath $shortcut.TargetPath)) { throw 'Zastupce na plose nema platny cil.' }

  Write-Host "Hotovo. Ikona Life Is Bitch ukazuje na: $($shortcut.TargetPath)" -ForegroundColor Green
} catch {
  Write-Error "Aktualizace se nezdarila: $($_.Exception.Message)"
  exit 1
}
