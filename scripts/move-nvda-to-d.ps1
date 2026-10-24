<#
.SYNOPSIS
  把 NVDA 从 C:\Program Files\NVDA 迁到 D:\Tools\NVDA（需以管理员身份运行）。
.NOTES
  1) 先下载安装包到 D:\Tools\nvda\nvda-setup.exe；
  2) 卸载旧版 → 用 /D 指定 D 盘目录静默安装 → 迁移用户配置；
  3) 完成后可运行 D:\Tools\NVDA\nvda.exe 验证。
#>
param(
  [string]$Installer = "D:\Tools\nvda\nvda-setup.exe",
  [string]$Target = "D:\Tools\NVDA"
)
$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "请以管理员身份运行本脚本（右键 PowerShell → 以管理员身份运行）"
}
if (-not (Test-Path $Installer)) { throw "找不到安装包：$Installer" }

Write-Host "[1/4] 结束正在运行的 NVDA..." -ForegroundColor Cyan
Get-Process nvda, nvdaHelperRemoteLoader -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[2/4] 卸载旧版（若存在）..." -ForegroundColor Cyan
$uninstall = (Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'NVDA*' } | Select-Object -First 1).QuietUninstallString
if ($uninstall) {
  $exe = ($uninstall -split '"')[1]
  $args2 = ($uninstall -split '"')[2]
  if ($exe) { Start-Process -FilePath $exe -ArgumentList $args2 -Wait }
}

Write-Host "[3/4] 安装到 $Target ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Target | Out-Null
Start-Process -FilePath $Installer -ArgumentList '/S', "/D=$Target" -Wait

Write-Host "[4/4] 迁移用户配置..." -ForegroundColor Cyan
$cfg = Join-Path $env:APPDATA 'nvda'
if (Test-Path $cfg) { Copy-Item $cfg (Join-Path $Target 'userconfig-backup') -Recurse -Force -ErrorAction SilentlyContinue }

if (Test-Path (Join-Path $Target 'nvda.exe')) {
  Write-Host "完成：$Target\nvda.exe" -ForegroundColor Green
} else {
  Write-Warning "安装包可能忽略了 /D 参数，请手动确认 $Target"
}
