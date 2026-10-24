import type { ModuleDefinition } from "../../protocol";

export interface CacheInput {
  /** 地址位宽，预设 12/16/20/32 */
  addrBits: number;
  /** 块大小（字节），必须是 2 的幂 */
  blockBytes: number;
  /** Cache 行数，必须是 2 的幂 */
  lines: number;
  /** 访问地址（十六进制字符串） */
  accesses: string[];
}

export interface CacheLineState {
  valid: boolean;
  /** 标记位（十进制，展示时转十六进制） */
  tag: number;
  /** 主存块号，未装载为 -1 */
  block: number;
  /** 组内 LRU 用的逻辑时间戳 */
  lastUsed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  compulsory: number;
  conflict: number;
}

export interface CacheCurrent {
  addr: number;
  tag: number;
  index: number;
  offset: number;
}

export interface CacheState {
  addrBits: number;
  blockBytes: number;
  lines: CacheLineState[];
  stats: CacheStats;
  /** 当前访问已解码的地址分量（SPLIT 之后存在） */
  current?: CacheCurrent;
  /** 当前被探测/命中的行号 */
  activeLine?: number;
}

export type CacheEvent =
  | { type: "SPLIT"; addr: number; tag: number; index: number; offset: number }
  | { type: "PROBE"; line: number; valid: boolean; tag: number | null }
  | { type: "HIT"; line: number }
  | { type: "MISS"; cause: "compulsory" | "conflict"; line: number; evictedTag?: number }
  | { type: "LOAD"; line: number; tag: number; block: number }
  | { type: "DONE"; hits: number; misses: number };

export type CacheModule = ModuleDefinition<CacheInput, CacheState, CacheEvent>;