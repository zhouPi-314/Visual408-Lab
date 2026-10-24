# Cloudflare Pages 部署（国内访问更快）

**当前已上线：<https://visual408-lab.pages.dev/>**（项目名 `visual408-lab`，生产分支 `main`）

日常更新（本地构建后直传）：

```powershell
cd "D:\项目设计\计算机 408 可视化交互学习平台03"
$env:CI = 'true'
pnpm build
npx --yes wrangler@latest pages deploy apps/web/dist --project-name visual408-lab
```

> 站点是纯静态产物 + hash 路由 + 相对路径，**不需要改任何配置**，根路径即可运行。

## 方式 A：网页操作（推荐，不用装任何东西）

1. 打开 <https://dash.cloudflare.com/sign-up> 注册（邮箱即可，免费）。
2. 登录后左侧 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**。
3. 首次会要求授权 GitHub：点 **Authorize Cloudflare Pages**，只勾选 `Visual408-Lab` 仓库。
4. 选择仓库 `zhouPi-314/Visual408-Lab` → **Begin setup**。
5. 填写构建配置：

   | 字段 | 值 |
   | --- | --- |
   | Project name | `visual408-lab` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `pnpm build` |
   | Build output directory | `apps/web/dist` |
   | 环境变量 | `NODE_VERSION=24`，`CI=true` |

6. 点 **Save and Deploy**，首次构建约 1–2 分钟。
7. 成功后地址：<https://visual408-lab.pages.dev>（免费子域，自动 HTTPS）。
8. 之后每次 `git push` 都会自动重新部署。

## 方式 B：PowerShell 直接上传（不接 Git，构建在本地做）

```powershell
# 0) 把 wrangler 缓存也放 D 盘（可选，避免占 C 盘）
$env:WRANGLER_HOME = 'D:\Tools\wrangler'
New-Item -ItemType Directory -Force -Path $env:WRANGLER_HOME | Out-Null

# 1) 登录（会弹出浏览器，授权一次）
cd "D:\项目设计\计算机 408 可视化交互学习平台03"
npx wrangler@latest login

# 2) 本地构建
$env:CI = 'true'
pnpm install
pnpm build

# 3) 首次创建项目
npx wrangler@latest pages project create visual408-lab --production-branch main

# 4) 上传 dist（之后每次改版只需重复第 2、4 步）
npx wrangler@latest pages deploy apps/web/dist --project-name visual408-lab
```

上传成功后命令行会直接打印 `https://<hash>.visual408-lab.pages.dev` 与生产地址。

## 验证清单

- 打开首页，确认 4 个学科卡片都在；
- 点进任一实验，按「下一步」能推进；
- 手机浏览器打开，确认底部是悬浮 Dock；
- 顶栏点「☀/☾」能切换深色/浅色。

## 与 GitHub Pages 的关系

两个地址可以同时存在，内容一致。GitHub Pages 随 `push` 自动更新；
Cloudflare 走方式 A 时也随 `push` 更新，走方式 B 则需手动执行第 4 步。
