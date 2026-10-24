import type { CacheLineState, CacheStats } from "./types";

/**
 * 可复用内核：只做「地址解码 + 命中判定 + 装入」，不产生帧。
 *
 * 支持直接映射与组相联：`ways === 1` 即直接映射（历史行为不变）。
 * 跨学科模块与 co 的两个 Cache 模块共用这一份语义。
 */

export interface CacheParams {
  addrBits: number;
  blockBytes: number;
  /** Cache 总行数 */
  lines: number;
  /** 每组行数，默认 1（直接映射） */
  ways?: number;
}

export interface CacheCore {
  lines: CacheLineState[];
  stats: CacheStats;
  /** 逻辑时钟，用于组内 LRU */
  clock: number;
}

export interface DecodedAddress {
  addr: number;
  block: number;
  tag: number;
  /** 组号（直接映射时等于行号） */
  index: number;
  offset: number;
}

export interface ProbeResult extends DecodedAddress {
  outcome: "hit" | "miss";
  cause?: "compulsory" | "conflict";
  /** 命中/装入的绝对行号 */
  line: number;
  /** 组内路号 */
  way: number;
  evictedTag?: number;
}

export const log2 = (n: number) => Math.round(Math.log2(n));
export const waysOf = (params: CacheParams) => Math.max(1, Math.round(params.ways ?? 1));
export const setsOf = (params: CacheParams) => Math.max(1, Math.round(params.lines / waysOf(params)));

export function createCore(params: CacheParams): CacheCore {
  return {
    lines: Array.from({ length: params.lines }, () => ({ valid: false, tag: 0, block: -1, lastUsed: 0 })),
    stats: { hits: 0, misses: 0, compulsory: 0, conflict: 0 },
    clock: 0,
  };
}

export function decodeAddr(params: CacheParams, addr: number): DecodedAddress {
  const offsetMask = params.blockBytes - 1;
  const sets = setsOf(params);
  const setMask = sets - 1;
  const block = addr >>> log2(params.blockBytes);
  return {
    addr,
    block,
    tag: block >>> log2(sets),
    index: block & setMask,
    offset: addr & offsetMask,
  };
}

/** 就地推进内核状态并返回本次判定结果 */
export function probeCache(params: CacheParams, core: CacheCore, addr: number): ProbeResult {
  const decoded = decodeAddr(params, addr);
  const ways = waysOf(params);
  const start = decoded.index * ways;
  const entries = core.lines.slice(start, start + ways);

  const hitWay = entries.findIndex((l) => l.valid && l.tag === decoded.tag);
  if (hitWay >= 0) {
    core.stats.hits += 1;
    core.clock += 1;
    core.lines[start + hitWay] = { ...core.lines[start + hitWay]!, lastUsed: core.clock };
    return { ...decoded, outcome: "hit", line: start + hitWay, way: hitWay };
  }

  core.stats.misses += 1;
  const cause = entries.some((l) => l.valid) ? "conflict" : "compulsory";
  if (cause === "compulsory") core.stats.compulsory += 1;
  else core.stats.conflict += 1;

  const freeWay = entries.findIndex((l) => !l.valid);
  const way =
    freeWay >= 0
      ? freeWay
      : entries.reduce((best, l, i) => (l.lastUsed < entries[best]!.lastUsed ? i : best), 0);
  const line = start + way;
  const evictedTag = entries[way]!.valid ? entries[way]!.tag : undefined;
  core.clock += 1;
  core.lines[line] = { valid: true, tag: decoded.tag, block: decoded.block, lastUsed: core.clock };

  return {
    ...decoded,
    outcome: "miss",
    cause,
    line,
    way,
    ...(evictedTag !== undefined ? { evictedTag } : {}),
  };
}

export const cloneLines = (lines: CacheLineState[]): CacheLineState[] => lines.map((l) => ({ ...l }));
export const cloneStats = (stats: CacheStats): CacheStats => ({ ...stats });
