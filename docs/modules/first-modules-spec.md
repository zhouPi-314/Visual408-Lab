# 首批交互模块规格（阶段 0）

> 目的：在写代码之前，把「教学目标 → 状态机 → 输入输出 → 测试向量 → 综合实验连接点」定死。
> 约定：所有模块实现为 `packages/sim-core` 下的**纯函数模拟器**，输出不可变 `Frame[]`（见 `architecture-proposal.md` §6）。
> 测试向量中的期望值均**已用独立实现复算**（页面置换与地址换算本轮实跑验证），可直接作为黄金用例。

## 0. 模块总表

| id | 学科 | 模块 | 演示器类型 | 输入模式 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `ds.binary-tree-traversal` | 数据结构 | 二叉树遍历与递归栈 | single-step | preset / custom / boundary | **已实现**（14 个测试） |
| `co.cache-direct-mapped` | 计算机组成原理 | Cache 直接映射与地址划分 | single-step + interactive | preset / custom / boundary | **已实现**（12 个测试） |
| `os.page-replacement` | 操作系统 | 页面置换（FIFO/LRU/OPT） | single-step + interactive | preset / custom / boundary | **已实现**（12 个测试，含 Belady） |
| `net.tcp-handshake` | 计算机网络 | TCP 建立与释放（状态机） | single-step | preset / scenario | **已实现**（10 个测试） |
| `cross.va-access-chain` | 综合 | 虚拟地址访问链路 | single-step + timeline | preset / custom | **已实现**（13 个测试） |

---

## 1. `ds.binary-tree-traversal`｜二叉树遍历与递归栈

### 1.1 元数据

| 字段 | 值 |
| --- | --- |
| 学科 / 考纲版本 | 数据结构 / 2026 |
| 先修 | 树与二叉树定义、递归 |
| 关联 | 栈（`ds.stack-queue`）、哈夫曼树、程序执行链路（`cross.program-execution`） |
| 演示器类型 | single-step（预计算轨迹） |
| 代码联动 | C++ 递归版 + 显式栈非递归版 |

### 1.2 教学目标

1. 能说出三种遍历中「访问根结点」发生的时机差异，而不是背口诀。
2. 能画出任意一棵树的递归调用栈进出过程，并解释「为什么中序非递归要用栈」。
3. 能把遍历结果与「栈的最大深度 = 树高」这一不变量对上号。

### 1.3 输入 / 校验

```ts
interface TraversalInput {
  tree: (string | null)[];   // 层序数组，null 表示空位；下标 0 为根
  order: "pre" | "in" | "post" | "level";
  mode: "recursive" | "iterative";
}
```

校验规则：节点数 1–31；`null` 不得早于其父；值唯一（重复值报 `error`，因为影响判定）；`level` 仅允许 `iterative`（队列）。

### 1.4 状态机

```
IDLE ──initialize──▶ ENTER(node)
ENTER(node) ──push frame──▶ 依 order：
   pre  : EMIT(node) → ENTER(left)…
   in   : ENTER(left)… → EMIT(node) → ENTER(right)…
   post : ENTER(left)… → ENTER(right)… → EMIT(node)
空子树 ──▶ RETURN(空) ──pop──▶ 回到父帧
所有帧 pop ──▶ DONE
```

事件类型：`ENTER`（入栈）、`EMIT`（访问）、`RETURN`（出栈）、`ENQUEUE/DEQUEUE`（层序）。
每帧 `state` 含：`stack: {nodeId, phase}[]`、`visited: string[]`、`current`、`code.line`。

### 1.5 测试向量（黄金用例）

标准树：`A(B(D,E), C(_,F))`，层序 `["A","B","C","D","E",null,"F"]`

| 用例 | 输入 | 期望访问序列 | 帧数 / 事件断言 |
| --- | --- | --- | --- |
| T1 | order=pre, recursive | **A B D E C F** | 按 `ENTER/EMIT/RETURN` 逐事件断言（帧数于实现时锁定，不预填） |
| T2 | order=in, recursive | **D B E A C F** | 同上 |
| T3 | order=post, recursive | **D E B F C A** | 同上 |
| T4 | order=in, iterative | 同 T2 | 按显式栈事件计 |
| T5 | tree=["A"], pre | **A** | ENTER→EMIT→RETURN 共 3 个事件 |
| T6 | tree=[]（空树） | `[]`，并给出提示而非报错 | 仅初始化帧 |
| T7 | 重复值 `["A","A"]` | `validate()` 返回 error，不生成帧 | — |

不变量（属性测试）：`stack.length ≤ 树高 + 1`；`visited` 单调增长且无重复；最终 `visited.length === 节点数`。

### 1.6 常见误区（用于讲解与错因反馈）

- 把「先序 = 先访问根」套到中序上 → 用 `EMIT` 时机高亮纠正。
- 认为递归「没有栈」→ 显式展示每帧的 push/pop。
- 中序非递归写成「先入右再入左」→ 在动作题中给出方向性错因。

### 1.7 综合实验连接点

- → `cross.program-execution`：递归深度对应运行时栈，**栈溢出**演示。
- → 操作系统「进程栈 / 函数调用」；计组「栈指针 SP 的变化」。

---

## 2. `co.cache-direct-mapped`｜Cache 直接映射与地址划分

### 2.1 元数据

| 字段 | 值 |
| --- | --- |
| 学科 / 考纲 | 计算机组成原理 / 2026 |
| 先修 | 二进制与十六进制、地址概念 |
| 关联 | 存储层次、`cross.va-access-chain` |
| 演示器类型 | single-step + interactive（可手动输入地址观察） |

### 2.2 教学目标

1. 给定 Cache 参数，**独立算出** tag / index / offset 的位数。
2. 能判断一次访问是命中、强制缺失还是冲突缺失，并解释「为什么同一 index 的不同块互相踢出」。
3. 能算命中率并对照「容量 / 块大小 / 相联度」三者的取舍。

### 2.3 参数与输入

```ts
interface CacheInput {
  addrBits: 16;            // 预设集合：12/16/20/32
  blockBytes: 16;          // 4/8/16/32/64
  lines: 8;                // 2/4/8/16
  mapping: "direct";       // 阶段 1 只做直接映射
  accesses: string[];      // 十六进制字符串，如 ["0x0A3","0x1A3"]
}
```

派生量：`offsetBits = log2(blockBytes)`、`indexBits = log2(lines)`、`tagBits = addrBits − offsetBits − indexBits`。
本组默认参数：**16 位地址 / 16 B 块 / 8 行 → tag 9 位、index 3 位、offset 4 位**。

### 2.4 状态机

```
TAKE(addr) → SPLIT(tag,index,offset) → PROBE(line[index])
  ├─ valid=0                → MISS(强制) → LOAD
  ├─ valid=1 ∧ tag 相同      → HIT
  └─ valid=1 ∧ tag 不同      → MISS(冲突) → EVICT(oldTag) → LOAD(newTag)
→ UPDATE_STATS → 下一条
```

事件：`SPLIT`、`PROBE`、`COMPARE`、`HIT`、`MISS`（带 `cause: "compulsory" | "conflict"`）、`EVICT`、`LOAD`。
每帧 `state` 含：`table: {valid,tag,block}[]`、`highlightLine`、`stats: {hits,misses,byType}`。

### 2.5 测试向量（已复算）

参数：16 位地址 / 16 B 块 / 8 行（直接映射）。

| 序号 | 地址 | 块号 | index | tag | 期望结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0x0A3 | 10 | **2** | 0x001 | MISS（强制）→ 装入 |
| 2 | 0x1A3 | 26 | **2** | 0x003 | MISS（冲突）→ 淘汰 0x001 |
| 3 | 0x2A3 | 42 | **2** | 0x005 | MISS（冲突）→ 淘汰 0x003 |
| 4 | 0x0A3 | 10 | **2** | 0x001 | MISS（冲突）→ 淘汰 0x005 |

> 注意：用例 4 **不是命中**——这是本模块最重要的教学点（同一地址多次访问仍可能因冲突缺失而 miss）。若追加第 5 次访问 0x0A3，则为 **HIT**。因此：4 次访问时 hits=0、misses=4（命中率 0%）；5 次访问时 hits=1、misses=4（命中率 1/5 = 20%）。

不变量：`hits + misses === accesses.length`；直接映射下 `容量缺失 = 0`；任意时刻每行至多一个 tag。

### 2.6 常见误区

- 用「地址相同就命中」——忽略中间被别的块替换掉。
- offset 位数算成块号的位数。
- 把「冲突缺失」算成「容量缺失」。

### 2.7 综合实验连接点

- ← `cross.va-access-chain`：物理地址 → Cache 查询。
- → 与「组相联 / 全相联」对比（阶段 2 扩展）。

---

## 3. `os.page-replacement`｜页面置换（FIFO / LRU / OPT）

### 3.1 元数据

| 字段 | 值 |
| --- | --- |
| 学科 / 考纲 | 操作系统 / 2026 |
| 先修 | 分页存储、缺页中断 |
| 关联 | `cross.va-access-chain`、虚拟内存、TLB |
| 演示器类型 | single-step + interactive（用户选择淘汰页） |

### 3.2 教学目标

1. 能对给定引用串**逐列**填出物理块状态与缺页标记。
2. 能解释 LRU 与 FIFO 的差别，并说明 **Belady 异常**为何只出现在 FIFO。
3. 能算缺页率并说明「帧数增加不一定更好」。

### 3.3 输入

```ts
interface ReplacementInput {
  ref: string;             // 引用串，如 "7,0,1,2,0,3,..."
  frames: number;          // 1–5
  alg: "FIFO" | "LRU" | "OPT";
  mode: "auto" | "manual"; // manual：由学习者点选淘汰页，错了给教学反馈
}
```

校验：页号 0–9；帧数 1–5；串长 ≤ 40（保证一屏可读）。

### 3.4 状态机

```
STEP(p) → LOOKUP(p)
  ├─ 在内存 → HIT → 更新访问序（LRU）
  └─ 不在   → FAULT
        ├─ 有空闲帧 → ALLOC(p)
        └─ 已满    → CHOOSE(victim)   // FIFO:最早装入 / LRU:最久未用 / OPT:最远将来
                       → EVICT(victim) → ALLOC(p)
→ RECORD(column) → 下一位
```

### 3.5 测试向量（**已用独立实现复算**，与教材经典结果一致）

引用串：`7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1`（20 次），帧数 3：

| 算法 | 缺页次数 | 缺页率 | 备注 |
| --- | --- | --- | --- |
| FIFO | **15** | 0.75 | 前 3 次为强制缺页 |
| LRU | **12** | 0.60 | 第 5、7、12、13、15、17、19、20 次命中 |
| OPT | **9** | 0.45 | 理论上界，用作对照而非可实现策略 |

**Belady 异常用例**（FIFO 专属）：引用串 `1,2,3,4,1,2,5,1,2,3,4,5`

| 帧数 | FIFO 缺页 | LRU 缺页 |
| --- | --- | --- |
| 3 | **9** | 10 |
| 4 | **10**（反而变差） | 8 |

> 该用例是「帧数增加不一定更好」的唯一硬证据，务必作为模块的收尾关卡。

不变量：`hits + faults === ref.length`；`内存块数 === min(frames, 已访问不同页数)`；LRU 下淘汰页必为「最久未用」。

### 3.6 常见误区

- LRU 与 FIFO 混淆（LRU 看**最近使用**，FIFO 看**装入时间**）。
- 命中时忘记更新 LRU 顺序。
- 认为 OPT 可用于实际系统。

### 3.7 综合实验连接点

- → `cross.va-access-chain`：缺页处理阶段直接调用本模块的淘汰策略。
- → 操作系统「抖动 / 工作集」扩展（阶段 2）。

---

## 4. `net.tcp-handshake`｜TCP 连接建立与释放

### 4.1 元数据

| 字段 | 值 |
| --- | --- |
| 学科 / 考纲 | 计算机网络 / 2026 |
| 先修 | 报文段结构、序号/确认号 |
| 关联 | `cross.network-send-chain`、可靠传输、拥塞控制 |
| 演示器类型 | single-step（场景预设） |

### 4.2 教学目标

1. 能默写三次握手的四元组与 `seq/ack` 关系，说明「为什么是三次而不是两次」。
2. 能画出四次挥手的完整状态迁移，解释 `TIME_WAIT` 的存在理由（2MSL）。
3. 能处理三个异常场景：`RST` 拒绝、同时关闭、末次 ACK 丢失。

### 4.3 输入与场景

```ts
interface TcpInput {
  clientIsn: number;       // 默认 1000
  serverIsn: number;       // 默认 5000
  clientDataBytes: number; // 默认 1000
  scenario: "normal" | "rst-refused" | "simultaneous-close" | "last-ack-lost";
}
```

### 4.4 状态机（子集，RFC 9293 术语）

```
CLOSED ──SYN──▶ SYN_SENT ──SYN+ACK──▶ ESTABLISHED
CLOSED ──LISTEN──▶ LISTEN ──SYN──▶ SYN_RCVD ──ACK──▶ ESTABLISHED
ESTABLISHED ──FIN──▶ FIN_WAIT_1 ──ACK──▶ FIN_WAIT_2 ──FIN──▶ TIME_WAIT ──2MSL──▶ CLOSED
ESTABLISHED ──FIN(收到)──▶ CLOSE_WAIT ──FIN──▶ LAST_ACK ──ACK──▶ CLOSED
FIN_WAIT_1 ──FIN──▶ CLOSING ──ACK──▶ TIME_WAIT
```

### 4.5 报文序列（正常场景，默认参数，可直接作为黄金用例）

| # | 方向 | 标志 | seq | ack | 说明 |
| --- | --- | --- | --- | --- | --- |
| 1 | C→S | SYN | 1000 | — | 客户端 ISN |
| 2 | S→C | SYN,ACK | 5000 | **1001** | 确认 SYN，消耗 1 个序号 |
| 3 | C→S | ACK | **1001** | **5001** | 三次握手完成 |
| 4 | C→S | PSH,ACK | 1001 | 5001 | 发送 1000 B 数据（占 1001–2000） |
| 5 | S→C | ACK | 5001 | **2001** | 确认收到 |
| 6 | S→C | PSH,ACK | 5001 | 2001 | 服务端回 200 B（占 5001–5200） |
| 7 | C→S | ACK | 2001 | **5201** | — |
| 8 | C→S | FIN,ACK | 2001 | 5201 | 主动关闭（FIN 占 1 序号） |
| 9 | S→C | ACK | 5201 | **2002** | 半关闭 |
| 10 | S→C | FIN,ACK | 5201 | 2002 | 服务端也关 |
| 11 | C→S | ACK | **2002** | **5202** | 进入 TIME_WAIT，等待 2MSL |

### 4.6 异常场景期望

| 场景 | 关键期望 |
| --- | --- |
| `rst-refused` | 2 号报文变为 `RST,ACK`；客户端直接回 CLOSED；不进入 ESTABLISHED |
| `simultaneous-close` | 双方几乎同时发 FIN → 各自经历 `FIN_WAIT_1 → CLOSING → TIME_WAIT` |
| `last-ack-lost` | 11 号丢失 → 服务端超时重传 FIN；客户端在 TIME_WAIT 内重发 ACK |

不变量：序号空间单调；`ESTABLISHED` 必须经过至少 3 个报文；进入 `CLOSED` 前必经过 `TIME_WAIT` 或 `RST`。

### 4.7 常见误区

- 认为第三次握手「没有数据所以可省」。
- 把 `ack` 写成「确认的序号」而不是「期望的下一个序号」。
- `TIME_WAIT` 只记「等 2MSL」却说不清为什么（可靠终止 + 让旧报文消散）。

### 4.8 综合实验连接点

- → `cross.network-send-chain`：应用数据 → TCP 分段 → IP → 帧。

---

## 5. `cross.va-access-chain`｜虚拟地址访问链路（综合原型）

### 5.1 定位

把「程序访问一个变量」拆成 8 个阶段，串起 **操作系统（TLB/页表/缺页）+ 组成原理（Cache/主存）**。这是本项目与「单科动画集合」的核心差异点。

### 5.2 阶段

```
CPU 产生逻辑地址 VA
 1 SPLIT_VPN_OFFSET   拆 VPN / offset
 2 TLB_LOOKUP         命中 → 直接得 PFN ；未命中 → 3
 3 PAGE_WALK          查页表（单级或多级）
 4 PAGE_FAULT?        页不在内存 → 调页 → 更新页表/TLB
 5 BUILD_PA           PA = PFN × 页大小 + offset
 6 CACHE_LOOKUP       并行于 5 之后：拆 tag/index/offset → 命中/缺失
 7 MEMORY_ACCESS      缺失时访问主存（块装入 Cache）
 8 DELIVER            返回数据给 CPU
```

### 5.3 参数与测试向量（**已复算**）

页大小 4 KiB（offset 12 位）；块 16 B、8 行、16 位物理地址（index 3 位、tag 9 位）。

| VA | VPN | offset | PFN | PA | Cache block | index | tag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0x1A3C | 1 | 0xA3C | 5 | **0x5A3C** | 1443 | **3** | **0xB4** |
| 0x2A7C | 2 | 0xA7C | 7 | **0x7A7C** | 1959 | 7 | 0xF4 |
| 0x1A44 | 1 | 0xA44 | 5 | **0x5A44** | 1444 | 4 | 0xB4 |
| 0x3B10 | 3 | 0xB10 | 9 | **0x9B10** | 2481 | 1 | 0x136 |

推荐演示序列（用于讲「TLB 命中 ≠ Cache 命中」）：
`0x1A3C → 0x1A44 → 0x1A3C → 0x2A7C → 0x1A3C`
期望：第 1 次 TLB miss + 缺页 + Cache miss；第 2 次 TLB hit + Cache miss（不同块/不同行）；第 3 次 TLB hit + Cache **hit**（同块 0x5A3C 所在块仍在）；第 5 次回到 0x1A3C 仍可能 hit（若未被 0x2A7C 挤掉——按 index 3 vs 7 不同行，**不冲突**）。

> 这一序列的教学价值：让学习者看到**四层命中率相互独立**，不能用「TLB 命中」推断「Cache 命中」。

### 5.4 输入校验

VA 必须落在进程地址空间上限内；页表项 must 有 valid 位与 PFN；帧数固定；非法输入返回 `Issue` 而非抛异常。

### 5.5 连接点

- 直接复用 `co.cache-direct-mapped` 与 `os.page-replacement` 的**同一份**实现（演示器组合，不复制逻辑）。
- 输出「本模块依赖 X 个单科模块」的自动索引，形成学习路径。

---

## 6. 内容来源与版权状态（逐模块）

| 模块 | 理论稿 | 题目 | 代码示例 | 版权状态 |
| --- | --- | --- | --- | --- |
| ds.binary-tree-traversal | 自写 | **原创改编**（不复制原题） | 自写 C++ | 可发布 |
| co.cache-direct-mapped | 自写 | 原创 + 参数化 | 自写 C++ | 可发布 |
| os.page-replacement | 自写（引用串为公开教学通用串） | 原创 | 自写 C++ | 可发布 |
| net.tcp-handshake | 自写（基于 RFC 9293 公开规范） | 原创 | 自写 C++ | 可发布 |
| cross.va-access-chain | 自写 | 原创 | 自写 C++ | 可发布 |

**规则**：真题只登记「年份 + 考点映射」，题面与解析一律原创；任何非原创条目必须填 `authorized: true` 且附授权说明，否则构建失败。

## 7. 阶段 1 交付顺序建议

1. `co.cache-direct-mapped`（纯计算、无外部依赖，最适合先打穿「协议 + 播放器 + 测试」链路）
2. `ds.binary-tree-traversal`（验证渲染层：树布局 + 栈视图）
3. `os.page-replacement`（验证交互式：用户点选淘汰）
4. `net.tcp-handshake`（验证状态机图与时间轴）
5. `cross.va-access-chain`（组合前四个，作为阶段 1 的验收原型）
