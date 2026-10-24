import type { AnyRenderer } from "./types";
import { renderer as treeRenderer } from "../modules/binary-tree/BinaryTreeModule";
import { renderer as assocRenderer } from "../modules/associative/AssocModule";
import { renderer as cacheRenderer } from "../modules/cache/CacheModule";
import { renderer as pageRenderer } from "../modules/page-replacement/PageReplacementModule";
import { renderer as schedRenderer } from "../modules/scheduling/SchedModule";
import { renderer as subnetRenderer } from "../modules/subnetting/SubnetModule";
import { renderer as graphRenderer } from "../modules/graph/GraphModule";
import { renderer as searchRenderer } from "../modules/search/SearchModule";
import { renderer as sortRenderer } from "../modules/sorting/SortModule";
import { renderer as tcpRenderer } from "../modules/tcp/TcpModule";
import { renderer as crossRenderer } from "../modules/cross/VaChainModule";
import { renderer as sendRenderer } from "../modules/network-send/SendModule";
import { renderer as execRenderer } from "../modules/program-execution/ExecModule";

export type SubjectKey = "ds" | "co" | "os" | "net" | "cross";

export interface Subject {
  key: SubjectKey;
  label: string;
  hint: string;
}

export const SUBJECTS: Subject[] = [
  { key: "ds", label: "数据结构", hint: "树 · 图 · 排序 · 查找" },
  { key: "co", label: "计算机组成原理", hint: "存储层次 · 指令 · 流水线" },
  { key: "os", label: "操作系统", hint: "进程 · 内存 · 文件" },
  { key: "net", label: "计算机网络", hint: "分层 · TCP · 子网" },
  { key: "cross", label: "综合实验室", hint: "跨学科链路实验" },
];

export interface Experiment {
  id: string;
  subject: SubjectKey;
  title: string;
  summary: string;
  /** 一句话「学完能回答什么」 */
  takeaway: string;
  status: "ready" | "planned";
  renderer?: AnyRenderer;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "ds.binary-tree-traversal",
    subject: "ds",
    title: "二叉树遍历与递归栈",
    summary: "先序 / 中序 / 后序 / 层序，逐帧看递归栈的进出与访问时机。",
    takeaway: "栈深 = 还没返回的祖先个数",
    status: "ready",
    renderer: treeRenderer as AnyRenderer,
  },
  {
    id: "ds.sorting",
    subject: "ds",
    title: "排序：插入 / 冒泡 / 快速",
    summary: "柱状图逐次交换：比较、移动、枢轴定位全过程，可切三种算法对照。",
    takeaway: "快排最坏退化成 O(n²)，而插入在近乎有序时最快",
    status: "ready",
    renderer: sortRenderer as AnyRenderer,
  },
  {
    id: "ds.graph-traversal",
    subject: "ds",
    title: "图的遍历 BFS / DFS",
    summary: "邻接矩阵上一层层扩散（队列）或一条路走到黑（栈），树边同步标出。",
    takeaway: "BFS 用队列按层、DFS 用栈深入",
    status: "ready",
    renderer: graphRenderer as AnyRenderer,
  },
  {
    id: "ds.search",
    subject: "ds",
    title: "查找：顺序 / 折半",
    summary: "区间逐次砍半，看清 mid 怎么选、哪半边被排除。",
    takeaway: "折半必须在有序表上，比较次数约 log₂n",
    status: "ready",
    renderer: searchRenderer as AnyRenderer,
  },
  {
    id: "co.cache-direct-mapped",
    subject: "co",
    title: "Cache 直接映射",
    summary: "地址三段拆分、命中判定、强制缺失与冲突缺失的完整推演。",
    takeaway: "同一地址也可能两次缺失",
    status: "ready",
    renderer: cacheRenderer as AnyRenderer,
  },
  {
    id: "co.cache-associative",
    subject: "co",
    title: "组相联与全相联映射",
    summary: "同一地址串在 1 路与 2 路下的缺失对比，看清相联度换来了什么。",
    takeaway: "相联度用并行比较换更少的冲突缺失",
    status: "ready",
    renderer: assocRenderer as AnyRenderer,
  },
  {
    id: "os.page-replacement",
    subject: "os",
    title: "页面置换 FIFO / LRU / OPT",
    summary: "教材式逐列表：每次访问后物理块的完整状态与缺页标记。",
    takeaway: "命中也要更新 LRU；Belady 只在 FIFO",
    status: "ready",
    renderer: pageRenderer as AnyRenderer,
  },
  {
    id: "os.scheduling",
    subject: "os",
    title: "进程调度 FCFS / SJF / RR",
    summary: "甘特图逐时刻推进：谁上 CPU、谁回队列、等待与周转怎么算。",
    takeaway: "周转 = 完成 − 到达；等待 = 周转 − 运行",
    status: "ready",
    renderer: schedRenderer as AnyRenderer,
  },
  {
    id: "net.tcp-handshake",
    subject: "net",
    title: "TCP 连接建立与释放",
    summary: "时序图 + 双端状态机，含 RST、末次 ACK 丢失、同时关闭。",
    takeaway: "FIN 占 1 个序号；TIME_WAIT 等 2MSL",
    status: "ready",
    renderer: tcpRenderer as AnyRenderer,
  },
  {
    id: "net.subnetting",
    subject: "net",
    title: "IPv4 子网划分",
    summary: "32 位逐位对照，拖前缀即时看到网络地址、广播地址与可用主机数。",
    takeaway: "可用主机 = 2^(32−前缀) − 2",
    status: "ready",
    renderer: subnetRenderer as AnyRenderer,
  },
  {
    id: "cross.va-access-chain",
    subject: "cross",
    title: "虚拟地址访问链路",
    summary: "一次访存走完 TLB → 页表 → 缺页 → Cache → 主存八个阶段。",
    takeaway: "TLB 命中 ≠ Cache 命中",
    status: "ready",
    renderer: crossRenderer as AnyRenderer,
  },
  {
    id: "cross.network-send-chain",
    subject: "cross",
    title: "网络数据发送链路",
    summary: "应用数据 → TCP 分段 → IP 封装 → 路由 → ARP → 成帧，看清每层加了什么。",
    takeaway: "跨子网时目的 MAC 是网关，不是最终主机",
    status: "ready",
    renderer: sendRenderer as AnyRenderer,
  },
  {
    id: "cross.program-execution-chain",
    subject: "cross",
    title: "程序执行链路",
    summary: "一行 C++ 拆成 6 条指令，走 5 级流水线，再被时间片切开。",
    takeaway: "load-use 冒险让 CPI 从 1 升到 2",
    status: "ready",
    renderer: execRenderer as AnyRenderer,
  },
];

export const subjectOf = (key: SubjectKey) => SUBJECTS.find((s) => s.key === key)!;

export const experimentsOf = (key: SubjectKey) => EXPERIMENTS.filter((e) => e.subject === key);

export const findExperiment = (id: string) => EXPERIMENTS.find((e) => e.id === id);