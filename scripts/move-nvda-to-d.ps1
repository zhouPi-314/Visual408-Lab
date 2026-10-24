<#
.SYNOPSIS
  把 NVDA 安装到 D:\Tools\NVDA（需管理员权限）。

.DESCRIPTION
  1) 校验安装包（存在、签名有效、产品名为 NVDA）
  2) 结束正在运行的 NVDA
  3) 卸载现有 NVDA（如有）
  4) 用 /S /D=D:\Tools\NVDA 静默安装
  5) 备份 %APPDATA%\nvda 用户配置

.EXAMPLE
  # 以管理员身份打开 PowerShell，然后：
  cd "D:\项目设计\计算机 408 可视化交互学习平台03"
  powershell -ExecutionPolicy Bypass -File .\scripts\move-nvda-to-d.ps1
#>
param(
  [string]$Installer = "D:\Tools\nvda\nvda-setup.exe",
  [string]$Target = "D:\Tools\NVDA"
)

$ErrorActionPreference = "Stop"

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "需要管理员权限：请右键“以管理员身份运行” PowerShell 后重试。" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $Installer)) {
  Write-Host "找不到安装包：$Installer" -ForegroundColor Red
  exit 1
}

$info = (Get-Item $Installer).VersionInfo
$sig = (Get-AuthenticodeSignature $Installer).Status
Write-Host "[校验] $($info.ProductName) $($info.FileVersion) / 签名 $sig" -ForegroundColor Cyan
if ($info.ProductName -notlike "NVDA*" -or $sig -ne "Valid") {
  Write-Host "安装包校验失败，已中止。" -ForegroundColor Red
  exit 1
}

Write-Host "[1/4] 结束正在运行的 NVDA..." -ForegroundColor Cyan
Get-Process nvda, nvdaHelperRemoteLoader -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[2/4] 卸载现有版本（如存在）..." -ForegroundColor Cyan
$keys = @(
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
$entry = foreach ($k in $keys) {
  Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "NVDA*" }
}
if ($entry) {
  $line = if ($entry.QuietUninstallString) { $entry.QuietUninstallString } else { $entry.UninstallString }
  Write-Host "  卸载：$line"
  & cmd.exe /c $line | Out-Null
  Start-Sleep -Seconds 3
} else {
  Write-Host "  未发现已安装的 NVDA。"
}

Write-Host "[3/4] 安装到 $Target ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Target | Out-Null
$proc = Start-Process -FilePath $Installer -ArgumentList "/S", "/D=$Target" -Wait -PassThru
Write-Host "  安装器退出码：$($proc.ExitCode)"

Write-Host "[4/4] 备份用户配置..." -ForegroundColor Cyan
$cfg = Join-Path $env:APPDATA "nvda"
if (Test-Path $cfg) {
  Copy-Item $cfg (Join-Path $Target "userconfig-backup") -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  已备份到 $Target\userconfig-backup"
}

$exe = Join-Path $Target "nvda.exe"
if (Test-Path $exe) {
  Write-Host "完成：$exe" -ForegroundColor Green
} else {
  Write-Host "安装器似乎忽略了 /D，请检查 $env:ProgramFiles\NVDA" -ForegroundColor Yellow
  exit 1
}
