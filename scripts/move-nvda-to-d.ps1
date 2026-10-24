<#
.SYNOPSIS
  把 NVDA 迁到 D:\Tools\NVDA 并移除 C 盘副本（需管理员权限）。

.DESCRIPTION
  NVDA 的 NSIS 安装器会忽略 /D 参数，"卸载+重装"并不能改变安装位置。
  因此改用「可移植副本」方案：
  1) 结束 NVDA 进程
  2) 把 C:\Program Files\NVDA 完整复制到 D:\Tools\NVDA
  3) 静默卸载 C 盘安装（uninstall.exe /S）
  4) 在桌面与开始菜单创建指向 D 盘副本的快捷方式
  5) 校验并给出启动参数

.EXAMPLE
  cd "D:\项目设计\计算机 408 可视化交互学习平台03"
  powershell -ExecutionPolicy Bypass -File .\scripts\move-nvda-to-d.ps1
#>
param(
  [string]$Source = "C:\Program Files\NVDA",
  [string]$Target = "D:\Tools\NVDA"
)

$ErrorActionPreference = "Stop"

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "需要管理员权限：请右键“以管理员身份运行” PowerShell 后重试。" -ForegroundColor Yellow
  exit 1
}

Write-Host "[1/5] 结束 NVDA..." -ForegroundColor Cyan
Get-Process nvda, nvdaHelperRemoteLoader -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if (Get-Process nvda -ErrorAction SilentlyContinue) {
  Write-Host "  NVDA 仍在运行（可能权限更高）。请按 Insert+Q 退出 NVDA 后重跑。" -ForegroundColor Yellow
  exit 1
}

Write-Host "[2/5] 复制到 $Target ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Target | Out-Null
if (Test-Path $Source) {
  Copy-Item (Join-Path $Source "*") $Target -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  已从 $Source 同步"
} elseif (-not (Test-Path (Join-Path $Target "nvda.exe"))) {
  Write-Host "  既没有 C 盘安装也没有 D 盘副本。" -ForegroundColor Red
  exit 1
}

Write-Host "[3/5] 卸载 C 盘安装..." -ForegroundColor Cyan
$uninstaller = Join-Path $Source "uninstall.exe"
if (Test-Path $uninstaller) {
  Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait
  Start-Sleep -Seconds 3
  Write-Host ("  C 盘目录仍存在：" + (Test-Path $Source))
} else {
  Write-Host "  未找到 uninstall.exe，跳过"
}

Write-Host "[4/5] 创建快捷方式..." -ForegroundColor Cyan
$exe = Join-Path $Target "nvda.exe"
if (-not (Test-Path $exe)) { Write-Host "  D 盘副本缺少 nvda.exe，已中止。" -ForegroundColor Red; exit 1 }
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath("Desktop"), (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"))) {
  $lnk = Join-Path $dir "NVDA (D盘).lnk"
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $exe
  $sc.WorkingDirectory = $Target
  $sc.Description = "NVDA 屏幕阅读器（D 盘副本）"
  $sc.Save()
  Write-Host "  $lnk"
}

Write-Host "[5/5] 完成" -ForegroundColor Green
Write-Host "  $exe" -ForegroundColor Green
Write-Host "  调试启动：& '$exe' -l 10 --log-file=$Target\nvda-debug.log" -ForegroundColor Green
