import type { ModuleDefinition } from "../../protocol";
import type { CacheLineState } from "../cache-direct-mapped/types";

export interface PageTableEntry {
  vpn: number;
  pfn: number;
}

export interface TlbEntry {
  vpn: number;
  pfn: number;
}

export interface FrameEntry {
  pfn: number;
  vpn: number;
  lastUsed: number;
}

export interface CrossInput {
  /** 页大小（字节），教学固定 4096 */
  pageSize: number;
  /** TLB 项数 */
  tlbEntries: number;
  /** 页表：VPN → PFN */
  pageTable: PageTableEntry[];
  /** 物理页帧数 */
  frameCount: number;
  /** Cache 参数（与 co.cache-direct-mapped 共用同一内核） */
  blockBytes: number;
  cacheLines: number;
  /** 16 位虚拟地址 */
  accesses: string[];
}

export interface CrossStats {
  tlbHits: number;
  tlbMisses: number;
  pageFaults: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface CrossCurrent {
  va: number;
  vpn: number;
  offset: number;
  pfn?: number;
  pa?: number;
  tag?: number;
  index?: number;
  blockOffset?: number;
  cacheLine?: number;
}

export interface CrossState {
  tlb: TlbEntry[];
  pageTable: PageTableEntry[];
  frames: FrameEntry[];
  cache: CacheLineState[];
  stats: CrossStats;
  /** 当前执行到第几阶段（1–8），0 表示尚未开始 */
  stage: number;
  doneStages: number[];
  current?: CrossCurrent;
  accessed: number;
}

export type CrossEvent =
  | { type: "SPLIT"; va: number; vpn: number; offset: number }
  | { type: "TLB_HIT"; vpn: number; pfn: number }
  | { type: "TLB_MISS"; vpn: number }
  | { type: "PAGE_HIT"; vpn: number; pfn: number }
  | { type: "PAGE_FAULT"; vpn: number; pfn: number; victimVpn?: number }
  | { type: "BUILD_PA"; pa: number }
  | { type: "CACHE_HIT"; line: number }
  | { type: "CACHE_MISS"; line: number; cause: "compulsory" | "conflict" }
  | { type: "MEMORY_ACCESS"; block: number }
  | { type: "DELIVER"; pa: number }
  | { type: "DONE"; stats: CrossStats };

export type CrossModule = ModuleDefinition<CrossInput, CrossState, CrossEvent>;
