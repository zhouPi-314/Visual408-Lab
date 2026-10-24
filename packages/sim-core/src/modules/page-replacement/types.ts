import type { ModuleDefinition } from "../../protocol";

export type ReplacementAlg = "FIFO" | "LRU" | "OPT";

export interface ReplacementInput {
  /** 引用串，逗号或空格分隔，页号 0–9 */
  ref: string;
  /** 物理块数 1–5 */
  frames: number;
  alg: ReplacementAlg;
}

export interface ColumnRecord {
  page: number;
  hit: boolean;
  victim?: number;
  frames: (number | null)[];
}

export interface ReplacementState {
  slots: (number | null)[];
  /** 从最久未用到最近使用的页号顺序（LRU 用） */
  recency: number[];
  stats: { hits: number; faults: number };
  accessed: number;
  alg: ReplacementAlg;
  current?: { page: number; hit: boolean; victim?: number; slot?: number };
  history: ColumnRecord[];
}

export type ReplacementEvent =
  | { type: "ACCESS"; page: number; column: number; inMemory: boolean }
  | { type: "HIT"; page: number; slot: number }
  | { type: "FAULT"; page: number; cause: "empty" | "full" }
  | { type: "EVICT"; victim: number; slot: number; reason: "oldest" | "least-recent" | "farthest" }
  | { type: "LOAD"; page: number; slot: number }
  | { type: "DONE"; hits: number; faults: number; rate: number };

export type ReplacementModule = ModuleDefinition<ReplacementInput, ReplacementState, ReplacementEvent>;
