import type { Frame, Issue, Simulator } from "../../protocol";
import {
  cloneLines,
  createCore,
  probeCache,
  type CacheCore,
  type CacheParams,
} from "../cache-direct-mapped/core";
import type { CrossEvent, CrossInput, CrossState, CrossStats, FrameEntry, TlbEntry } from "./types";

const META = {
  id: "cross.va-access-chain",
  subject: "cross" as const,
  title: "虚拟地址访问链路",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·操作系统·虚拟存储器 + 计算机组成原理·存储系统", kind: "syllabus" as const },
    { label: "跨学科组合实验（本项目原创）", kind: "original" as const },
  ],
};

/** 8 个阶段，供 UI 与测试共用 */
export const STAGES = [
  { id: 1, key: "SPLIT", label: "拆分虚拟地址" },
  { id: 2, key: "TLB", label: "查 TLB" },
  { id: 3, key: "WALK", label: "查页表" },
  { id: 4, key: "FAULT", label: "缺页处理" },
  { id: 5, key: "PA", label: "合成物理地址" },
  { id: 6, key: "CACHE", label: "查 Cache" },
  { id: 7, key: "MEMORY", label: "访问主存" },
  { id: 8, key: "DELIVER", label: "返回数据" },
] as const;

export const DEFAULT_PAGE_TABLE = [
  { vpn: 0, pfn: 3 },
  { vpn: 1, pfn: 5 },
  { vpn: 2, pfn: 7 },
  { vpn: 3, pfn: 9 },
];

export const DEFAULT_ACCESSES = ["0x1A3C", "0x1A44", "0x1A3C", "0x2A7C", "0x1A3C"];

export const defaultInput: CrossInput = {
  pageSize: 4096,
  tlbEntries: 4,
  pageTable: DEFAULT_PAGE_TABLE,
  frameCount: 8,
  blockBytes: 16,
  cacheLines: 8,
  accesses: DEFAULT_ACCESSES,
};

const isPow2 = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<CrossInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];

  if (!isPow2(v.pageSize ?? 0)) issues.push({ path: "pageSize", message: "页大小必须是 2 的幂", severity: "error" });
  if (!Number.isInteger(v.tlbEntries) || (v.tlbEntries as number) < 1 || (v.tlbEntries as number) > 16) {
    issues.push({ path: "tlbEntries", message: "TLB 项数只能是 1–16", severity: "error" });
  }
  if (!Number.isInteger(v.frameCount) || (v.frameCount as number) < 1 || (v.frameCount as number) > 32) {
    issues.push({ path: "frameCount", message: "物理页帧数只能是 1–32", severity: "error" });
  }
  if (!isPow2(v.blockBytes ?? 0)) issues.push({ path: "blockBytes", message: "块大小必须是 2 的幂", severity: "error" });
  if (!isPow2(v.cacheLines ?? 0)) issues.push({ path: "cacheLines", message: "Cache 行数必须是 2 的幂", severity: "error" });
  if (!Array.isArray(v.pageTable)) {
    issues.push({ path: "pageTable", message: "页表必须是数组", severity: "error" });
  }
  if (!Array.isArray(v.accesses) || v.accesses.length === 0) {
    issues.push({ path: "accesses", message: "至少需要一条访问地址", severity: "error" });
  } else {
    if (v.accesses.length > 32) issues.push({ path: "accesses", message: "一次最多 32 条访问", severity: "error" });
    v.accesses.forEach((raw, i) => {
      if (typeof raw !== "string" || !/^(0x)?[0-9a-fA-F]+$/.test(raw.trim())) {
        issues.push({ path: `accesses[${i}]`, message: `"${String(raw)}" 不是合法十六进制地址`, severity: "error" });
        return;
      }
      const addr = Number.parseInt(raw.trim().replace(/^0x/i, ""), 16);
      if (addr > 0xffff) issues.push({ path: `accesses[${i}]`, message: "本实验使用 16 位虚拟地址", severity: "error" });
    });
  }
  return issues;
}

export const simulate: Simulator<CrossInput, CrossState, CrossEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as CrossInput;
  const frames: Frame<CrossState, CrossEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const pageBits = Math.round(Math.log2(input.pageSize));
  const cacheParams: CacheParams = {
    addrBits: 16,
    blockBytes: input.blockBytes,
    lines: input.cacheLines,
  };
  const core: CacheCore = createCore(cacheParams);

  let tlb: TlbEntry[] = [];
  const resident: FrameEntry[] = [];
  const stats: CrossStats = { tlbHits: 0, tlbMisses: 0, pageFaults: 0, cacheHits: 0, cacheMisses: 0 };
  const doneStages: number[] = [];
  let stage = 0;
  let current: CrossState["current"];
  let accessed = 0;

  const snapshot = (): Omit<CrossState, "current"> => ({
    tlb: tlb.map((e) => ({ ...e })),
    pageTable: input.pageTable.map((e) => ({ ...e })),
    frames: resident.map((f) => ({ ...f })),
    cache: cloneLines(core.lines),
    stats: { ...stats },
    stage,
    doneStages: [...doneStages],
    accessed,
  });

  const push = (event: CrossEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: { ...snapshot(), ...(current ? { current: { ...current } } : {}) },
      event,
      narration,
    });
  };

  const step = (n: number) => {
    stage = n;
    if (!doneStages.includes(n)) doneStages.push(n);
  };

  for (const raw of input.accesses) {
    accessed += 1;
    const va = Number.parseInt(raw.trim().replace(/^0x/i, ""), 16);
    const vpn = va >>> pageBits;
    const offset = va & (input.pageSize - 1);
    current = { va, vpn, offset };
    doneStages.length = 0;

    step(1);
    push(
      { type: "SPLIT", va, vpn, offset },
      `拆分 VA=0x${va.toString(16).toUpperCase()}：VPN=${vpn}，页内偏移=0x${offset.toString(16).toUpperCase()}`,
    );

    // 2. TLB
    step(2);
    const hit = tlb.find((e) => e.vpn === vpn);
    let pfn: number | undefined;
    if (hit) {
      stats.tlbHits += 1;
      pfn = hit.pfn;
      tlb = [...tlb.filter((e) => e.vpn !== vpn), { vpn, pfn }];
      current = { ...current, pfn };
      push({ type: "TLB_HIT", vpn, pfn }, `TLB 命中：VPN ${vpn} → PFN ${pfn}，省掉一次页表访问`);
    } else {
      stats.tlbMisses += 1;
      push({ type: "TLB_MISS", vpn }, `TLB 未命中：VPN ${vpn} 不在 TLB 中，必须查页表`);
    }

    // 3. 页表 / 4. 缺页
    const pte = input.pageTable.find((e) => e.vpn === vpn);
    if (pte) {
      step(3);
      pfn = pte.pfn;
      current = { ...current, pfn };
      if (!hit) {
        // 填入 TLB（满则淘汰最久未用的项，TLB 只有 4 项，先到先出足够教学）
        tlb = [...tlb, { vpn, pfn }].slice(-input.tlbEntries);
      }
      const isResident = resident.some((f) => f.pfn === pfn);
      if (isResident) {
        push({ type: "PAGE_HIT", vpn, pfn }, `页表项有效：PFN=${pfn}，该页已在内存，不产生缺页`);
      } else {
        step(4);
        stats.pageFaults += 1;
        let victimVpn: number | undefined;
        if (resident.length >= input.frameCount) {
          const victim = [...resident].sort((a, b) => a.lastUsed - b.lastUsed)[0]!;
          victimVpn = victim.vpn;
          resident.splice(resident.indexOf(victim), 1);
        }
        resident.push({ pfn, vpn, lastUsed: accessed });
        push(
          { type: "PAGE_FAULT", vpn, pfn, ...(victimVpn !== undefined ? { victimVpn } : {}) },
          victimVpn === undefined
            ? `**缺页**：VPN ${vpn} 对应的 PFN ${pfn} 还不在内存，调入一个新页帧`
            : `**缺页**：内存已满，按 LRU 淘汰 VPN ${victimVpn}，调入 VPN ${vpn} → PFN ${pfn}`,
        );
      }
    } else {
      step(3);
      push({ type: "PAGE_HIT", vpn, pfn: -1 }, `页表中没有 VPN ${vpn} 的映射 → 段错误（本实验不继续）`);
      continue;
    }

    // 5. 物理地址
    step(5);
    const pa = pfn! * input.pageSize + offset;
    current = { ...current, pa };
    push(
      { type: "BUILD_PA", pa },
      `合成物理地址：PA = PFN × 页大小 + 偏移 = ${pfn} × ${input.pageSize} + 0x${offset.toString(16).toUpperCase()} = 0x${pa.toString(16).toUpperCase()}`,
    );

    // 6. Cache（复用 co.cache-direct-mapped 的内核）
    step(6);
    const result = probeCache(cacheParams, core, pa);
    current = {
      ...current,
      tag: result.tag,
      index: result.index,
      blockOffset: result.offset,
      cacheLine: result.line,
    };
    if (result.outcome === "hit") {
      stats.cacheHits += 1;
      push(
        { type: "CACHE_HIT", line: result.line },
        `Cache 命中：第 ${result.line} 行，tag=0x${result.tag.toString(16).toUpperCase()}，不必访问主存`,
      );
    } else {
      stats.cacheMisses += 1;
      push(
        { type: "CACHE_MISS", line: result.line, cause: result.cause! },
        `Cache 缺失（${result.cause === "compulsory" ? "强制" : "冲突"}）：第 ${result.line} 行没有这个块，需要访问主存`,
      );
      step(7);
      push(
        { type: "MEMORY_ACCESS", block: result.block },
        `访问主存块 ${result.block}，装入第 ${result.line} 行（tag=0x${result.tag.toString(16).toUpperCase()}）`,
      );
    }

    step(8);
    push({ type: "DELIVER", pa }, `把数据返回给 CPU：物理地址 0x${pa.toString(16).toUpperCase()}`);
  }

  stage = 8;
  push(
    { type: "DONE", stats: { ...stats } },
    `链路结束：TLB 命中 ${stats.tlbHits} / 缺失 ${stats.tlbMisses}，缺页 ${stats.pageFaults}，Cache 命中 ${stats.cacheHits} / 缺失 ${stats.cacheMisses}`,
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;
