/**
 * 演示器协议 —— 全平台唯一的状态推演契约。
 *
 * 三条铁律（见 docs/architecture-proposal.md §6.1）：
 * 1. 纯函数：simulate() 不读时钟、不用随机、不碰 DOM。
 * 2. 不可变轨迹：一次性算出全部帧，播放只是移动索引（step/back 均为 O(1)）。
 * 3. 状态即快照：每帧携带完整可渲染状态，而不是增量补丁。
 *
 * 本包不依赖任何第三方库，以保证可被浏览器、Node、Worker 同构复用。
 */

export type Severity = "error" | "warning";

export interface Issue {
  /** 出错位置，如 "accesses[2]"、"blockBytes" */
  path: string;
  /** 面向学习者的中文说明 */
  message: string;
  severity: Severity;
}

export type SubjectId = "ds" | "co" | "os" | "net" | "cross";

export interface SimReference {
  label: string;
  kind: "textbook" | "syllabus" | "standard" | "original";
  note?: string;
}

export interface SimMeta {
  id: string;
  subject: SubjectId;
  title: string;
  syllabusVersion: string;
  references: SimReference[];
}

/** 一帧 = 一个可渲染状态 + 一个已发生的事件 + 一句讲解 */
export interface Frame<S, E> {
  index: number;
  state: S;
  event: E;
  narration: string;
  /** 代码联动：本条事件对应的 C++ 代码位置 */
  code?: { file: string; line: number };
  /** 手算校验点（可选） */
  quiz?: Checkpoint;
}

export interface Checkpoint {
  prompt: string;
  answer:
    | { kind: "choice"; options: string[]; correct: number }
    | { kind: "number"; correct: number; tolerance?: number }
    | { kind: "text"; accept: string[] };
  hint?: string;
}

export interface Simulation<I, S, E> {
  readonly input: I;
  readonly meta: SimMeta;
  readonly frames: readonly Frame<S, E>[];
  /** 输入域校验 + 不变量检查；含 error 时不产生帧 */
  validate(): readonly Issue[];
}

export type Simulator<I, S, E> = (input: I) => Simulation<I, S, E>;

/** 模块定义：注册表与 UI 只认这个形状，不认具体实现 */
export interface ModuleDefinition<I, S, E> {
  readonly meta: SimMeta;
  readonly defaultInput: I;
  readonly simulate: Simulator<I, S, E>;
}
