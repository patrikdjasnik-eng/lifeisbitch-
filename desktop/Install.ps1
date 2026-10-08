param([string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\LifeIsBitch'), [switch]$NoLaunch)
$ErrorActionPreference = 'Stop'
try {
  $sourceDir = Join-Path $PSScriptRoot 'game'
  if (-not (Test-Path (Join-Path $sourceDir 'Life Is Bitch.exe'))) { throw 'Nejprve rozbal celý ZIP. Herní soubory chybí.' }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item (Join-Path $sourceDir '*') $InstallDir -Recurse -Force
  $exe = Join-Path $InstallDir 'Life Is Bitch.exe'
  $desktop = [Environment]::GetFolderPath('Desktop')
  New-Item -ItemType Directory -Force -Path $desktop | Out-Null
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Life Is Bitch.lnk'))
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $InstallDir
  $shortcut.IconLocation = "$exe,0"
  $shortcut.Save()
  Write-Output 'Life Is Bitch je připravená. Zástupce je na ploše.'
  if (-not $NoLaunch) { Start-Process -FilePath $exe }
} catch {
  Write-Error "Instalace selhala: $($_.Exception.Message)" -ErrorAction Continue
  exit 1
}
