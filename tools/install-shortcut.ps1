# ReqTrack デスクトップショートカットインストーラ。
# 実行するとユーザのデスクトップに「ReqTrack.lnk」を作成する。
# ショートカットからは tools/launch-reqtrack.ps1 が PowerShell で起動される。

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repoRoot "tools\launch-reqtrack.ps1"

if (-not (Test-Path $launcher)) {
    Write-Host "[reqtrack] launcher script not found: $launcher" -ForegroundColor Red
    exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "ReqTrack.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "shell32.dll,21"  # フォルダアイコン
$shortcut.Description = "ReqTrack - 要件→見積→ガント→進捗管理"
$shortcut.WindowStyle = 1  # 通常ウィンドウ (ログ確認のため)
$shortcut.Save()

Write-Host "[reqtrack] shortcut created at: $shortcutPath" -ForegroundColor Green
Write-Host "[reqtrack] double-click to launch ReqTrack." -ForegroundColor Green
