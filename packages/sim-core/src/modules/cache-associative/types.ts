import type { ModuleDefinition } from "../../protocol";

export interface AssocInput {
  addrBits: number;
  blockBytes: number;
  /** Cache 总行数 */
  lines: number;
  /** 每组行数：1 = 直接映射，2/4 = 组相联，lines = 全相联 */
  ways: number;
  accesses: string[];
}

export interface AssocState {
  addrBits: number;
  blockBytes: number;
  lines: number;
  ways: number;
  sets: number;
  linesState: { valid: boolean; tag: number; block: number; lastUsed: number }[];
  stats: { hits: number; misses: number; compulsory: number; conflict: number };
  current?: { addr: number; tag: number; index: number; offset: number };
  activeLine?: number;
}

export type AssocEvent =
  | { type: "SPLIT"; addr: number; tag: number; index: number; offset: number; sets: number }
  | { type: "PROBE_SET"; index: number; ways: { valid: boolean; tag: number }[] }
  | { type: "HIT"; line: number; way: number }
  | { type: "MISS"; cause: "compulsory" | "conflict"; index: number }
  | { type: "EVICT"; line: number; way: number; tag: number }
  | { type: "LOAD"; line: number; way: number; tag: number }
  | { type: "DONE"; hits: number; misses: number };

export type AssocModule = ModuleDefinition<AssocInput, AssocState, AssocEvent>;
