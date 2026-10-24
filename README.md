# Visual408 Lab · 计算机 408 可视化交互学习实验室

**An interactive, open-source lab for visualizing CS408 fundamentals — right in your browser.**

[在线使用](https://visual408-lab.pages.dev/) · [GitHub Pages 镜像](https://zhoupi-314.github.io/Visual408-Lab/) · [反馈建议](https://github.com/zhouPi-314/Visual408-Lab/issues) · [贡献指南](CONTRIBUTING.md)

![在线](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%BF%E7%94%A8-visual408--lab.pages.dev-4338ca)
![测试](https://img.shields.io/badge/tests-166%20passed-15803d)
![无障碍](https://img.shields.io/badge/axe%20a11y-0%20violations-15803d)
![许可](https://img.shields.io/badge/license-MIT-444)

---

## 这是什么

把 408 的抽象概念做成**可以一步一步推的交互实验**：改参数、点下一步、看状态怎么变，而不是看动画。

- **打开即用**：无需安装、无需注册，学习进度保存在你自己的浏览器里；
- **13 个实验**，覆盖数据结构、计算机组成原理、操作系统、计算机网络，以及 3 个跨学科综合实验；
- **每个实验都有确定性测试**：教学数值（命中率、缺页数、CPI、握手序号…）都能被复现和验证；
- **多学习档案**：同一浏览器可建多个档案，进度互不干扰；
- **实验内搜索与相关实验**：不用回目录就能找到本实验的知识点与相邻实验。

## 在线使用（推荐）

| 入口 | 地址 | 说明 |
| --- | --- | --- |
| 主站 | <https://visual408-lab.pages.dev/> | 国内访问较快 |
| 镜像 | <https://zhoupi-314.github.io/Visual408-Lab/> | GitHub Pages 自动部署 |

手机上也能用：底部的播放控件是悬浮 Dock，不会遮挡内容。

## 实验一览

| 学科 | 实验 | 一句话收获 |
| --- | --- | --- |
| 数据结构 | 二叉树遍历 | 栈深 = 还没返回的祖先个数 |
| 数据结构 | 排序（插入/冒泡/快排） | 插入排序是「空位 + 手里拿着值」 |
| 数据结构 | 图遍历 BFS/DFS | BFS 用队列按层，DFS 用栈深入 |
| 数据结构 | 查找（顺序/折半） | 折半必须有序列且要求随机访问 |
| 计算机组成原理 | Cache 直接映射 | 同一个地址也可能两次缺失 |
| 计算机组成原理 | 组相联 Cache | 相联度用并行比较换更少的冲突缺失 |
| 操作系统 | 页面置换 | 命中也要更新 LRU；Belady 只在 FIFO |
| 操作系统 | 进程调度 | 周转 = 完成 − 到达；RR 的同刻入队次序容易错 |
| 计算机网络 | TCP 连接管理 | FIN 占 1 个序号；TIME_WAIT 等 2MSL |
| 计算机网络 | IPv4 子网划分 | 可用主机 = 2^(32−前缀) − 2 |
| 综合实验 | 虚拟地址访问链路 | TLB 命中 ≠ Cache 命中 |
| 综合实验 | 网络发送链路 | 分段 ≠ 分片；跨子网时目的 MAC 是网关 |
| 综合实验 | 程序执行链路 | load-use 冒险让 CPI 从 1 升到 2 |

每个实验统一提供：参数输入、单步/回放、代码联动、巩固练习（答题记录进错题本）。
另有**题库页**，可检索全部原创题目与解析。

## 设计原则

1. **确定性**：模拟器是纯函数，同一输入永远得到同一帧序列，禁止随机与时钟；
2. **可验证**：每个实验的黄金数值都写成测试，改坏了会立刻红；
3. **低耦合**：实验只依赖协议，不依赖播放器与存储；新增实验不改框架；
4. **无后端**：纯静态站点，运行时零网络请求，数据只在你本机。

## 技术原理（简述）

```
content/ (yaml+mdx)  ──构建期校验──▶  知识索引
packages/sim-core   纯函数 simulate(input) → Frame[]
packages/display    共享渲染组件（面板/指标/表格/流水线）
apps/web            只负责装配：路由、播放器、存储
```

- **不可变帧**：一次算出全部状态快照，回退只是移动索引（O(1)），不需要重放；
- **组合而非复制**：跨学科实验直接复用单科内核（例如访问链路调用 Cache 判定），有对账测试；
- **存储端口化**：`StoragePort` 有内存与 IndexedDB 两个实现，将来接云端只换适配器；
- **版权门禁**：内容 schema 强制 `authorized` 字段，未授权内容会让构建失败。

## 本地开发

需要 **Node.js ≥ 24** 与 **pnpm ≥ 11**。不需要数据库、不需要 Docker。

```powershell
git clone https://github.com/zhouPi-314/Visual408-Lab.git
cd Visual408-Lab
pnpm install
pnpm dev          # http://127.0.0.1:5173
```

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器 |
| `pnpm test` | 166 个单元测试 |
| `pnpm typecheck` | 类型检查 |
| `pnpm build` | 生产构建（`apps/web/dist`） |
| `pnpm content:check` | 内容校验 + 版权门禁 |
| `pnpm a11y` | axe 无障碍审计（需本机 Edge） |

## 一键部署（想自己搭一份）

GitHub Pages 已配置自动部署：fork 后 push 到 `main` 即发布（`.github/workflows/deploy.yml`）。

Cloudflare Pages 已配置随 push 自动部署（`.github/workflows/deploy-cloudflare.yml`）：
在仓库 Secrets 里配置 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 即生效，未配置时该任务自动跳过。

也可以本地手动部署（国内更快）：

```powershell
npx --yes wrangler@latest pages deploy apps/web/dist --project-name <你的项目名>
```

也可以直接运行仓库里的脚本：

```powershell
./scripts/deploy-pages.ps1 -ProjectName <你的项目名>
```

## 目录结构

```
apps/web                 导航、实验页、题库、播放器
packages/sim-core        协议 + 13 个纯函数模拟器
packages/display         共享渲染组件
packages/storage         StoragePort（内存 / IndexedDB）
packages/content-schema  内容 schema + 版权门禁
content/<学科>/<实验>/    内容唯一事实源
docs/                    架构、部署、无障碍、备份演练
```

## 进度与路线图

**当前：13 个实验 / 166 个测试 / 双主题（浅色·深色）/ 无障碍 0 违规。**

**开发节奏（目标）**：以每天 15–20 个实验的速度补充，每个实验都附确定性测试与内容，
不为了数量牺牲可验证性。

- **近期**：补齐四科高频考点（图算法、指令周期、PV 操作、路由与 ARP 等）；实验内搜索；
- **中期**：本机多存档隔离、完整的题目解析库、更多跨学科链路（存储层次、可靠的传输）；
- **长期**：可选的云端账号与跨设备同步、在线 C++ 沙箱（需独立安全评审）、AI 讲题（可关闭）。

## 已知问题与修复记录

| 问题 | 现状 |
| --- | --- |
| 小屏播放条遮挡内容 | 已修：改为悬浮 Dock，留出安全区 |
| 代码行号对比度不足（axe serious） | 已修：标记装饰性并提高对比度 |
| 插入排序帧里出现重复值 | 已修：改为「空位 + 手里值」建模 |
| zod < 4.6.6 的 DoS 风险 | 已修：升级并保持审计 0 漏洞 |
| 宽表格在手机上横向滚动 | 已修：置换实验可切「只看当前列」 |
| 本地仅单一存档 | 已修：支持多学习档案（进度隔离） |
| 综合实验页表写死 | 已修：页表可在界面编辑（VPN:PFN） |
| 读屏器人工走查 | 已做：NVDA 实测通过，见 [无障碍审计](docs/a11y-audit.md) |

## 参与贡献

欢迎 Issue / PR / 纠错 / 建议：

- 发现知识性错误：请指出实验名与第几步，最好附上教材依据；
- 新增实验：请同时提交模拟器、黄金测试、内容与截图；
- 界面与无障碍：优先修对比度、键盘路径与移动端问题。

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可与致谢

- 代码：[MIT](LICENSE)；**借鉴或复用时请注明来源**，详见 [NOTICE](NOTICE)；
- 内容：题目与解析均为原创，不收录未授权真题与教材图表；
- 安全说明：[SECURITY.md](SECURITY.md)。

> 这个项目首先服务于本人的考研复习，所以**宁可少一个实验，也不放一个算错的实验**。
> 如果它对你有帮助，欢迎点个 Star ⭐ 或留下你的建议。