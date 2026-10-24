import type { Frame, Issue, Simulator } from "../../protocol";
import {
  cloneLines,
  cloneStats,
  createCore,
  decodeAddr,
  log2,
  probeCache,
  setsOf,
  waysOf,
  type CacheCore,
  type CacheParams,
} from "../cache-direct-mapped/core";
import type { AssocEvent, AssocInput, AssocState } from "./types";

const META = {
  id: "co.cache-associative",
  subject: "co" as const,
  title: "组相联与全相联映射",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·计算机组成原理·存储系统", kind: "syllabus" as const },
    { label: "组相联映射的教学复述（本项目原创，复用直接映射内核）", kind: "original" as const },
  ],
};

const ALLOWED_WAYS = [1, 2, 4, 8];
const isPow2 = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<AssocInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];

  if (![12, 16, 20, 32].includes(v.addrBits as number)) {
    issues.push({ path: "addrBits", message: "地址位宽只支持 12/16/20/32", severity: "error" });
  }
  if (!isPow2(v.blockBytes)) issues.push({ path: "blockBytes", message: "块大小必须是 2 的幂", severity: "error" });
  if (!isPow2(v.lines)) issues.push({ path: "lines", message: "Cache 行数必须是 2 的幂", severity: "error" });
  if (!ALLOWED_WAYS.includes(v.ways as number)) {
    issues.push({ path: "ways", message: `每组行数只支持 ${ALLOWED_WAYS.join("/")}`, severity: "error" });
  }
  if (Number.isInteger(v.lines) && Number.isInteger(v.ways) && (v.ways as number) > (v.lines as number)) {
    issues.push({ path: "ways", message: "每组行数不能超过总行数", severity: "error" });
  }
  if (!Array.isArray(v.accesses) || v.accesses.length === 0) {
    issues.push({ path: "accesses", message: "至少需要一条访问地址", severity: "error" });
  } else {
    if (v.accesses.length > 64) issues.push({ path: "accesses", message: "一次最多 64 条访问", severity: "error" });
    v.accesses.forEach((raw, i) => {
      if (typeof raw !== "string" || !/^(0x)?[0-9a-fA-F]+$/.test(raw.trim())) {
        issues.push({ path: `accesses[${i}]`, message: `"${String(raw)}" 不是合法十六进制地址`, severity: "error" });
      }
    });
  }
  return issues;
}

export const simulate: Simulator<AssocInput, AssocState, AssocEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as AssocInput;
  const frames: Frame<AssocState, AssocEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const params: CacheParams = {
    addrBits: input.addrBits,
    blockBytes: input.blockBytes,
    lines: input.lines,
    ways: input.ways,
  };
  const ways = waysOf(params);
  const sets = setsOf(params);
  const core: CacheCore = createCore(params);

  const push = (
    event: AssocEvent,
    narration: string,
    extra: Partial<Pick<AssocState, "current" | "activeLine">> = {},
  ) => {
    frames.push({
      index: frames.length,
      state: {
        addrBits: params.addrBits,
        blockBytes: params.blockBytes,
        lines: params.lines,
        ways,
        sets,
        linesState: cloneLines(core.lines),
        stats: cloneStats(core.stats),
        ...extra,
      },
      event,
      narration,
    });
  };

  for (const raw of input.accesses) {
    const addr = Number.parseInt(raw.trim().replace(/^0x/i, ""), 16);
    const decoded = decodeAddr(params, addr);
    const before = core.lines.slice(decoded.index * ways, decoded.index * ways + ways);
    const current = { addr, tag: decoded.tag, index: decoded.index, offset: decoded.offset };
    const hex = `0x${addr.toString(16).toUpperCase()}`;

    push(
      { type: "SPLIT", addr, tag: decoded.tag, index: decoded.index, offset: decoded.offset, sets },
      `拆分 ${hex}：块号 ${decoded.block} → 组号 ${decoded.index}（共 ${sets} 组），tag=0x${decoded.tag.toString(16).toUpperCase()}，offset=${decoded.offset}`,
      { current },
    );

    push(
      {
        type: "PROBE_SET",
        index: decoded.index,
        ways: before.map((l) => ({ valid: l.valid, tag: l.tag })),
      },
      `在第 ${decoded.index} 组内并行比较 ${ways} 路的 tag：` +
        before
          .map((l, w) => `way${w}=${l.valid ? "0x" + l.tag.toString(16).toUpperCase() : "空"}`)
          .join("、"),
      { current },
    );

    const result = probeCache(params, core, addr);

    if (result.outcome === "hit") {
      push(
        { type: "HIT", line: result.line, way: result.way },
        `第 ${result.way} 路 tag 相同 → **命中**（组内命中不需要淘汰）`,
        { current, activeLine: result.line },
      );
      continue;
    }

    push(
      { type: "MISS", cause: result.cause!, index: decoded.index },
      result.cause === "compulsory"
        ? `组内有空路 → **强制缺失**，直接装入第 ${result.way} 路`
        : `组内 ${ways} 路全满且 tag 都不匹配 → **冲突缺失**，按 LRU 淘汰第 ${result.way} 路`,
      { current },
    );

    if (result.evictedTag !== undefined) {
      push(
        { type: "EVICT", line: result.line, way: result.way, tag: result.evictedTag },
        `淘汰第 ${result.way} 路的旧标记 0x${result.evictedTag.toString(16).toUpperCase()}`,
        { current, activeLine: result.line },
      );
    }

    push(
      { type: "LOAD", line: result.line, way: result.way, tag: result.tag },
      `把块 ${decoded.block} 装入第 ${decoded.index} 组第 ${result.way} 路`,
      { current, activeLine: result.line },
    );
  }

  const { hits, misses, compulsory, conflict } = core.stats;
  push(
    { type: "DONE", hits, misses },
    `结束：${input.accesses.length} 次访问，命中 ${hits}、缺失 ${misses}（强制 ${compulsory} / 冲突 ${conflict}），命中率 ${((hits / input.accesses.length) * 100).toFixed(1)}%`,
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: AssocInput = {
  addrBits: 16,
  blockBytes: 16,
  lines: 8,
  ways: 2,
  accesses: ["0x003", "0x043", "0x083", "0x003", "0x083"],
};
