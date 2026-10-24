<#
.SYNOPSIS
  一键构建并部署 Visual408 Lab 到 Cloudflare Pages。
.EXAMPLE
  ./scripts/deploy-pages.ps1 -ProjectName visual408-lab
#>
param(
  [Parameter(Mandatory = $true)][string]$ProjectName,
  [string]$DistPath = "apps/web/dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/3] 安装依赖..." -ForegroundColor Cyan
$env:CI = "true"
pnpm install
if ($LASTEXITCODE -ne 0) { throw "依赖安装失败" }

Write-Host "[2/3] 构建..." -ForegroundColor Cyan
pnpm build
if ($LASTEXITCODE -ne 0) { throw "构建失败" }
if (-not (Test-Path $DistPath)) { throw "未找到构建产物：$DistPath" }

Write-Host "[3/3] 部署到 Cloudflare Pages：$ProjectName" -ForegroundColor Cyan
npx --yes wrangler@latest pages deploy $DistPath --project-name $ProjectName
if ($LASTEXITCODE -ne 0) { throw "部署失败（是否已执行 npx wrangler login？）" }

Write-Host "完成。生产地址：https://$ProjectName.pages.dev/" -ForegroundColor Green
