# 可复现部署指南

## 1. 一次性准备（需要你本人的 GitHub 凭据）

```powershell
# 1) 在 GitHub 创建空仓库（不要初始化 README），推荐名：Visual408-Lab
cd "D:\项目设计\计算机 408 可视化交互学习平台03"
git remote add origin https://github.com/<你的用户名>/Visual408-Lab.git
git push -u origin main
# 2) 仓库 Settings → Pages → Source 选 "GitHub Actions"
```

推送后 `deploy.yml` 自动执行：
install → typecheck → test → 内容门禁 → 隐私扫描 → build → 上传 → 部署。

成功后地址：`https://<你的用户名>.github.io/Visual408-Lab/`

## 2. 本地复现（不需要 GitHub）

```powershell
$env:CI='true'
pnpm install
pnpm build
pnpm --filter @visual408/web exec vite preview --port 4173
```

## 3. 子路径部署

页面地址形如 `https://user.github.io/Visual408-Lab/`。
本项目使用 **hash 路由**（`#co/...`），因此不需要服务器 rewrite，也不需要设置 `base`。

## 4. 回滚

```powershell
git revert <bad-commit>
```
Pages 随 main 分支自动重新部署。

## 5. 当前阻塞

本机缺 `gh` CLI、GitHub 凭据不可用（凭据管理器交互超时），
因此「真实推送 + CI 首跑 + 线上地址」需要你执行上面第 1 步；其余已完成。
