import type { Frame, Issue, Simulator } from "../../protocol";
import { cloneLines, cloneStats, createCore, decodeAddr, log2, probeCache } from "./core";
import type { CacheEvent, CacheInput, CacheState } from "./types";

const META = {
  id: "co.cache-direct-mapped",
  subject: "co" as const,
  title: "Cache 直接映射与地址划分",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·计算机组成原理·存储系统", kind: "syllabus" as const },
    { label: "Cache 直接映射的教学复述（本项目原创）", kind: "original" as const },
  ],
};

const PRESET_ADDR_BITS = [12, 16, 20, 32];

const isPow2 = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const value = input as Partial<CacheInput> | null;

  if (!value || typeof value !== "object") {
    return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  }
  if (!PRESET_ADDR_BITS.includes(value.addrBits as number)) {
    issues.push({ path: "addrBits", message: `地址位宽只支持 ${PRESET_ADDR_BITS.join("/")}`, severity: "error" });
  }
  if (!isPow2(value.blockBytes)) {
    issues.push({ path: "blockBytes", message: "块大小必须是 2 的正整数次幂", severity: "error" });
  }
  if (!isPow2(value.lines)) {
    issues.push({ path: "lines", message: "Cache 行数必须是 2 的正整数次幂", severity: "error" });
  }
  if (issues.length === 0) {
    const offsetBits = log2(value.blockBytes as number);
    const indexBits = log2(value.lines as number);
    if (offsetBits + indexBits >= (value.addrBits as number)) {
      issues.push({ path: "addrBits", message: "地址位宽不足以容纳 tag（至少需要 offset + index + 1 位）", severity: "error" });
    }
  }
  if (!Array.isArray(value.accesses)) {
    issues.push({ path: "accesses", message: "访问序列必须是数组", severity: "error" });
  } else {
    if (value.accesses.length === 0) {
      issues.push({ path: "accesses", message: "至少需要一条访问地址", severity: "error" });
    }
    if (value.accesses.length > 64) {
      issues.push({ path: "accesses", message: "一次最多 64 条访问（保证一屏可读）", severity: "error" });
    }
    value.accesses.forEach((raw, i) => {
      if (typeof raw !== "string" || !/^(0x)?[0-9a-fA-F]+$/.test(raw.trim())) {
        issues.push({ path: `accesses[${i}]`, message: `"${String(raw)}" 不是合法的十六进制地址`, severity: "error" });
        return;
      }
      const addr = Number.parseInt(raw.trim().replace(/^0x/i, ""), 16);
      if ((value.addrBits as number) && addr >= 2 ** (value.addrBits as number)) {
        issues.push({ path: `accesses[${i}]`, message: `地址 ${raw} 超出 ${value.addrBits} 位地址空间`, severity: "error" });
      }
    });
  }
  return issues;
}

export const simulate: Simulator<CacheInput, CacheState, CacheEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as CacheInput;
  const frames: Frame<CacheState, CacheEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const params = { addrBits: input.addrBits, blockBytes: input.blockBytes, lines: input.lines };
  const core = createCore(params);

  const push = (
    event: CacheEvent,
    narration: string,
    extra: Partial<Pick<CacheState, "current" | "activeLine">> = {},
    code?: { file: string; line: number },
  ) => {
    frames.push({
      index: frames.length,
      state: {
        addrBits: params.addrBits,
        blockBytes: params.blockBytes,
        lines: cloneLines(core.lines),
        stats: cloneStats(core.stats),
        ...extra,
      },
      event,
      narration,
      ...(code ? { code } : {}),
    });
  };

  for (const raw of input.accesses) {
    const addr = Number.parseInt(raw.trim().replace(/^0x/i, ""), 16);
    const decoded = decodeAddr(params, addr);
    const before = core.lines[decoded.index]!;
    const hex = `0x${addr.toString(16).toUpperCase()}`;
    const current = { addr, tag: decoded.tag, index: decoded.index, offset: decoded.offset };

    push(
      { type: "SPLIT", addr, tag: decoded.tag, index: decoded.index, offset: decoded.offset },
      `拆分 ${hex}：块号 ${decoded.block} → offset=${decoded.offset}，index=${decoded.index}，tag=0x${decoded.tag.toString(16).toUpperCase()}`,
      { current, activeLine: decoded.index },
      { file: "cache_direct.cpp", line: 12 },
    );

    push(
      { type: "PROBE", line: decoded.index, valid: before.valid, tag: before.valid ? before.tag : null },
      before.valid
        ? `探测第 ${decoded.index} 行：有效位=1，当前标记位=0x${before.tag.toString(16).toUpperCase()}`
        : `探测第 ${decoded.index} 行：有效位=0（该行从未装载过）`,
      { current, activeLine: decoded.index },
      { file: "cache_direct.cpp", line: 16 },
    );

    const result = probeCache(params, core, addr);

    if (result.outcome === "hit") {
      push(
        { type: "HIT", line: result.line },
        `标记位相同 → **命中**。累计：命中 ${core.stats.hits}，缺失 ${core.stats.misses}`,
        { current, activeLine: result.line },
        { file: "cache_direct.cpp", line: 16 },
      );
      continue;
    }

    push(
      {
        type: "MISS",
        cause: result.cause!,
        line: result.line,
        ...(result.evictedTag !== undefined ? { evictedTag: result.evictedTag } : {}),
      },
      result.cause === "compulsory"
        ? `该行有效位=0 → **强制缺失**（首次访问块 ${decoded.block}）`
        : `该行已被块 ${before.block}（tag=0x${(result.evictedTag ?? 0).toString(16).toUpperCase()}）占用 → **冲突缺失**，必须先淘汰`,
      { current, activeLine: result.line },
      { file: "cache_direct.cpp", line: 17 },
    );

    push(
      { type: "LOAD", line: result.line, tag: result.tag, block: result.block },
      `把主存块 ${decoded.block} 装入第 ${result.line} 行，标记位设为 0x${result.tag.toString(16).toUpperCase()}`,
      { current, activeLine: result.line },
      { file: "cache_direct.cpp", line: 18 },
    );
  }

  const { hits, misses, compulsory, conflict } = core.stats;
  push(
    { type: "DONE", hits, misses },
    `访问结束：共 ${input.accesses.length} 次，命中 ${hits}、缺失 ${misses}（强制 ${compulsory} / 冲突 ${conflict}），命中率 ${((hits / input.accesses.length) * 100).toFixed(1)}%`,
    { activeLine: 0 },
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: CacheInput = {
  addrBits: 16,
  blockBytes: 16,
  lines: 8,
  accesses: ["0x0A3", "0x1A3", "0x2A3", "0x0A3"],
};
