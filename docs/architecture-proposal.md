# 技术架构提案（阶段 0）

> 目标：在「单人 + 每周 10–20 h + 无云服务器 + 免费优先」的约束下，给出两套可落地架构并作出决策。
> 约束来源：单人维护、无云服务器、内容需离线可复现（见 README「设计要点」）。
> 状态：**提案，待用户确认后进入技术验证**。

## 1. 硬约束（不可协商）

1. 单人维护，无团队；任何需要专人运维的组件都是负担。
2. 现阶段**没有云服务器**，且不得把本机 DSH 或调试端口暴露公网。
3. 内容与模拟器必须**可离线运行、可确定性复现**（教学正确性 > 花哨效果）。
4. 四科 + 跨学科综合实验共用同一套播放器语义。
5. 未来要能迁到云端账号与数据库，**迁移不能推翻前端与模拟核心**。

## 2. 方案 A：静态前端 + 纯 TypeScript 模拟核心（**推荐起步**）

```
浏览器
 ├─ apps/web             React + Vite + TS（路由、页面、播放器 UI）
 ├─ packages/sim-core    纯 TS 模拟器（无 DOM / 无网络 / 无随机）
 ├─ packages/content-schema  Zod schema + 内容校验 CLI
 ├─ content/             模块内容（yaml + mdx + 测试向量）
 └─ IndexedDB (Dexie)    访客进度 / 收藏 / 错题 / 本地账号
```

- **运行时零后端**：构建时把 `content/` 编译成 JSON 索引；站点可托管到 GitHub Pages / Cloudflare Pages（免费）。
- **本地账号**：口令经 WebCrypto（PBKDF2-SHA256，高迭代）派生密钥，仅存本机；文档中**明确它不是服务器级身份认证**，只用于本机多用户隔离与进度区分。
- **C++ 执行**：构建期用 Emscripten 把预置样例编译为 WASM，运行期在 Web Worker 中执行并输出事件轨迹。**首版不执行用户代码**。
- **云迁移**：新增 `apps/api`（FastAPI 或 Node），复用**同一份** `packages/sim-core` 做服务端判题；前端只把「存储适配器」从 IndexedDB 换成 HTTP。

## 3. 方案 B：Next.js 全栈 + PostgreSQL

```
apps/web (Next.js App Router)
 ├─ server actions / route handlers
 ├─ Drizzle ORM → PostgreSQL
 └─ 认证（自建或 Auth.js）→ 会话 Cookie
content/ → 构建期导入 DB（或继续读文件）
```

- 客户端到服务端一体，SEO/SSR 天然支持。
- 账号、进度、题库需真实数据库与迁移；需要备份、限流、密钥管理。
- 本地开发要跑 DB（本机有服务）与可选 Docker；**Docker 守护进程当前未启动**。
- 免费托管受限：Vercel 免费额度 + 外部 Postgres（Supabase/Neon 免费档）会有休眠、容量与合规约束。

## 4. 四维对比

| 维度 | A. 静态 + 纯 TS 核心 | B. Next.js 全栈 + PG |
| --- | --- | --- |
| 本机资源 | 极低：只跑 Vite dev server；不动 Docker/DB | 中高：DB + (可选)Docker + Next dev；C 盘 43.9 GB 偏紧 |
| 可维护性（单人） | **高**：无服务端、无迁移、无密钥；故障面小 | 中低：认证、迁移、备份、CORS、限流都要人跟 |
| 免费成本 | **零**（静态托管 + 无 API） | 免费档可用但受限；自建需服务器费用 |
| 未来云部署 | 平滑：加 BFF，不动前端与核心 | 天然在线，但早期就背上运维 |
| 教学确定性 | **强**：模拟器纯函数，可同构复算 | 强，但易把逻辑散到 server action 里 |
| 上线速度（阶段 1–2） | **快** | 慢（先搭身份与数据层） |
| 账号真实性 | 弱（本地身份，明确声明） | **强**（真实注册/跨设备） |
| 搜索/SEO | 需预渲染或 sitemap | **强** |

## 5. 决策：A 起步，B 作为演进目标（Strangler 式）

**ADR-001｜采用方案 A 作为阶段 1–2 的实现架构。**

理由：单人项目的最大成本不是功能，而是**运维与状态同步**。方案 A 把「身份/存储」压缩成本地适配器，把复杂度集中在真正差异化的地方——模拟器与综合实验室。等出现「需要跨设备同步 / 多人协作」的真实需求，再按 §2 末尾的路径加 BFF，届时前端与 `sim-core` 不用重写。

**ADR-002｜前端：Vite + React + TS，不用 Next.js（阶段 1–2）。**
理由：本项目是**强交互应用**而非内容站，SSR 收益低；Vite 启动与构建更快，静态托管更省。

**ADR-003｜模拟器与渲染彻底分离，采用「预计算不可变轨迹」。**
见 §6。理由：回退/时间轴/状态对比在不可变轨迹下都是 O(1) 索引操作，避免手写 undo 栈产生的不一致。

**ADR-004｜内容以文件（yaml + mdx）为唯一事实源，构建期编译为 JSON。**
理由：内容可 PR 评审、可 diff、可离线校验；数据库只在阶段 3 需要检索/统计时引入。

**ADR-005｜首版 C++ 只跑预编译 WASM 样例；任意代码执行单独立项。**
理由：安全（R-09）。不把高风险能力作为首版前提。

## 6. 核心设计：演示器协议（`packages/sim-core`）

### 6.1 三条铁律

1. **纯函数**：`simulate(input)` 不读时钟、不用随机、不碰 DOM；同输入必得同输出。
2. **不可变轨迹**：一次性算出全部帧，播放只是移动索引。
3. **状态即快照**：每帧携带**完整可渲染状态**，而不是增量补丁（避免「回到第 7 帧」时需要重放）。

### 6.2 数据结构

```ts
// packages/sim-core/src/protocol.ts
export type Severity = "error" | "warning";

export interface Issue {
  path: string;          // 例如 "tree[3]"、"addresses[2]"
  message: string;       // 面向学习者的中文说明
  severity: Severity;
}

export interface SimMeta {
  id: string;            // "ds.binary-tree-traversal"
  subject: "ds" | "co" | "os" | "net" | "cross";
  title: string;
  syllabusVersion: string;
  references: { label: string; kind: "textbook" | "sylabus" | "standard" | "original"; note?: string }[];
}

/** 一帧 = 一个可渲染状态 + 一个已发生的事件 + 一句讲解 */
export interface Frame<S, E> {
  index: number;
  state: S;              // 完整快照（深不可变）
  event: E;              // 本帧触发的事件（用于事件列表/日志/测试断言）
  narration: string;     // 中文讲解，一步一句
  code?: { file: string; line: number; callStack?: string[] };
  quiz?: Checkpoint;     // 手算校验点（可选）
}

export interface Checkpoint {
  prompt: string;                    // "此时 TLB 是否命中？"
  answer: { kind: "choice"; options: string[]; correct: number }
        | { kind: "number"; correct: number; tolerance?: number }
        | { kind: "text"; accept: string[] };
  hint?: string;                     // 提示而非答案
}

export interface Simulation<I, S, E> {
  readonly input: I;
  readonly meta: SimMeta;
  readonly frames: readonly Frame<S, E>[];
  validate(): readonly Issue[];
}

/** 每个演示器导出一个纯函数 */
export type Simulator<I, S, E> = (input: I) => Simulation<I, S, E>;
```

### 6.3 六个协议方法如何落到轨迹上

规划文档要求的 `initialize / step / back / reset / serialize / validate`，在轨迹模型下的映射：

| 协议方法 | 实现 | 复杂度 |
| --- | --- | --- |
| `initialize(input)` | 校验输入 → 调 `simulate` → 缓存 frames → 索引置 0 | O(帧数) |
| `step()` | `index = min(index + 1, last)` | O(1) |
| `back()` | `index = max(index - 1, 0)` | O(1) |
| `reset()` | `index = 0` | O(1) |
| `serialize()` | `{ input, index, answers }` 的稳定 JSON（可分享 URL / 存进度） | O(1) |
| `validate(input)` | 输入域校验 + 不变量检查，返回 `Issue[]`（error 阻止运行） | O(输入) |

```ts
// packages/sim-core/src/player.ts
export interface PlayerConfig<I, S, E> {
  sim: Simulation<I, S, E>;
  onFrame?: (frame: Frame<S, E>, prev?: Frame<S, E>) => void;
}

export function createPlayer<I, S, E>(cfg: PlayerConfig<I, S, E>) {
  let i = 0;
  const frames = cfg.sim.frames;
  const emit = () => cfg.onFrame?.(frames[i], i > 0 ? frames[i - 1] : undefined);
  return {
    get index() { return i; },
    get length() { return frames.length; },
    get frame() { return frames[i]; },
    initialize() { i = 0; emit(); },
    step() { if (i < frames.length - 1) { i++; emit(); } },
    back() { if (i > 0) { i--; emit(); } },
    reset() { i = 0; emit(); },
    goto(n: number) { i = Math.min(Math.max(n, 0), frames.length - 1); emit(); },
    serialize() { return JSON.stringify({ input: cfg.sim.input, index: i }); },
  };
}
```

### 6.4 交互式实验（用户操作会改变状态）怎么办

不是所有模块都是「从头播到尾」。对「让学习者自己操作」的模块（如自己拖地址、自己选淘汰页），用**动作归约**扩展：

```ts
export interface InteractiveSim<I, S, A> {
  init(input: I): S;
  reduce(state: S, action: A): { state: S; events: SimEvent[] };
  validateAction(state: S, action: A): Issue | null;  // 非法操作给教学性反馈
}
```

- `reduce` 仍是**纯函数**，因此可用「录制的动作序列」做回归测试（`actions.json` → 期望状态）。
- 渲染层只看 `state`，与「预计算轨迹」共用同一套 `Frame` 渲染组件。

## 7. 内容模型（`packages/content-schema`）

```ts
export const ModuleSchema = z.object({
  id: z.string().regex(/^(ds|co|os|net|cross)\.[a-z0-9-]+$/),
  subject: z.enum(["ds", "co", "os", "net", "cross"]),
  title: z.string(),
  syllabusVersion: z.string(),                 // 如 "2026"
  prerequisites: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  objectives: z.array(z.string()).min(1),
  theory: z.string(),                          // mdx 文件名
  displayer: z.enum(["single-step", "interactive", "timeline"]),
  inputModes: z.array(z.enum(["preset", "custom", "random", "boundary"])).min(1),
  codeExamples: z.array(z.object({ lang: z.literal("cpp"), file: z.string(), verified: z.boolean() })),
  labTasks: z.array(z.string()).default([]),
  questions: z.array(z.object({
    id: z.string(),
    kind: z.enum(["choice", "fill", "hand-calculation", "ordering", "operation"]),
    source: z.object({
      kind: z.enum(["original", "authorized-exam", "user-import"]),
      year: z.number().optional(),
      license: z.string(),                     // "original" 也必须有值
      authorized: z.boolean(),
    }),
    answer: z.string(),
    explanation: z.string(),
  })),
  tests: z.string(),                           // tests.json 路径（黄金向量）
  sources: z.array(z.object({ label: z.string(), url: z.string().url().optional() })),
});
```

**硬规则**：`source.authorized === false` 且 `kind !== "original"` 的内容，构建时直接失败（对应 R-01）。

## 8. 仓库结构（阶段 1 目标）

```
Visual408-Lab/
├─ apps/
│  └─ web/                 # Vite + React + TS
├─ packages/
│  ├─ sim-core/            # 纯函数模拟器 + 播放器（无 DOM）
│  └─ content-schema/      # zod + 校验 CLI
├─ content/
│  ├─ ds/ co/ os/ net/ cross/
│  └─ index.json           # 构建期生成
├─ docs/                   # 本阶段文档 + adr/
├─ infra/                  # 预留（阶段 3：docker-compose、Caddy）
├─ tests/                  # 跨包集成与黄金向量
└─ .github/workflows/ci.yml
```

## 9. 测试策略（教学正确性是第一质量目标）

| 层级 | 做法 | 通过标准 |
| --- | --- | --- |
| 单元 | `sim-core` 每个模块的**黄金事件序列**（`tests.json`）逐帧断言 | 帧数 + 每帧 `event.type` + 关键字段 |
| 交叉验算 | 关键数值用**第二实现**或手算表复算（本轮已用于页面置换，见模块规格） | 两法一致 |
| 不变量 | 属性测试：如「栈深度 ≤ 树高」「已访问集合单调增长」「物理页帧数恒定」 | 随机 1000 例无违例 |
| 内容 | `content-schema` 全量校验 + 版权字段硬门禁 | 0 error |
| 端到端 | Playwright 冒烟：打开 → 单步 ×3 → 回退 ×1 → 刷新恢复 | 状态一致（阶段 2） |
| 无障碍 | 键盘可达（←/→/空格/R）、对比度检查 | 阶段 2 门禁 |

CI：GitHub Actions，Node 24，`pnpm -r test` + `pnpm lint` + 内容校验。

## 10. 部署

| 场景 | 方式 |
| --- | --- |
| 本地一键启动 | `pnpm i && pnpm dev`（仅需要 Node；不依赖 Docker/DB） |
| 公网体验（免费） | Cloudflare Pages 或 GitHub Pages，静态产物 + SPA fallback |
| 阶段 3 云端 | `apps/api` + PostgreSQL + `docker-compose`（infra/），HTTPS、限流、备份脚本 |
| 密钥 | 只走环境变量；仓库只保留 `.env.example` |

## 11. 明确不做（避免范围膨胀）

- 不做微服务拆分；不做 SSR；不做实时协作；不做服务端执行任意用户代码（阶段 3 前）。
- 不做「所有知识点都有动画」，只做首批 4+1 个精品模块。

## 12. 阶段 1 修订（2026-10-24，代码落地后）

实施过程中对 ADR 的补充与细化，逐条都有代码与测试对应：

| ADR | 内容 | 对应实现 |
| --- | --- | --- |
| ADR-006 | **存储端口化**：应用只依赖 `StoragePort`，不依赖 IndexedDB | `packages/storage/src/port.ts`；内存 + IndexedDB 两个适配器，19 个测试覆盖 |
| ADR-007 | **同步友好的记录模型**：每条记录带 `revision` + `updatedAt`，合并用 LWW | `mergeProgress()` + 针对性测试（旧备份不得覆盖新数据） |
| ADR-008 | **IndexedDB 版本化迁移**：`DB_VERSION` + `upgrade()` 只增不删 | `packages/storage/src/idb.ts` |
| ADR-009 | **模块渲染器随模块走**（部分落地：已按 `apps/web/src/modules/<id>/` 隔离，仍未进包） | `apps/web/src/modules/` |
| ADR-010 | **跨模块组合走共享内核，不复制逻辑**：Cache 判定抽为 `core.ts`，单科模块与综合模块共用；测试用同一物理地址序列对账 | `packages/sim-core/src/modules/cache-direct-mapped/core.ts` + `va-access-chain.test.ts`「组合而非复制」 |

量化依据与迁移触发条件见 [`architecture-assessment.md`](architecture-assessment.md)。