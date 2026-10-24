import type { Frame, Issue, Simulator } from "../../protocol";
import type {
  ColumnRecord,
  ReplacementAlg,
  ReplacementEvent,
  ReplacementInput,
  ReplacementState,
} from "./types";

const META = {
  id: "os.page-replacement",
  subject: "os" as const,
  title: "页面置换：FIFO / LRU / OPT",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·操作系统·虚拟内存与页面置换", kind: "syllabus" as const },
    { label: "经典引用串教学复述（本项目原创实现，结果与教材一致）", kind: "original" as const },
  ],
};

export const REF_PRESET =
  "7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1";

/** Belady 异常用例：FIFO 3 帧 9 次缺失，4 帧反而 10 次 */
export const BELADY_PRESET = "1,2,3,4,1,2,5,1,2,3,4,5";

export function parseRef(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const value = input as Partial<ReplacementInput> | null;
  if (!value || typeof value !== "object") {
    return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  }
  if (value.alg !== "FIFO" && value.alg !== "LRU" && value.alg !== "OPT") {
    issues.push({ path: "alg", message: "算法只能是 FIFO / LRU / OPT", severity: "error" });
  }
  if (!Number.isInteger(value.frames) || (value.frames as number) < 1 || (value.frames as number) > 5) {
    issues.push({ path: "frames", message: "物理块数只能是 1–5", severity: "error" });
  }
  if (typeof value.ref !== "string" || value.ref.trim() === "") {
    issues.push({ path: "ref", message: "引用串不能为空", severity: "error" });
  } else {
    const pages = parseRef(value.ref);
    if (pages.length > 40) {
      issues.push({ path: "ref", message: "引用串最多 40 次访问（保证一屏可读）", severity: "error" });
    }
    pages.forEach((p, i) => {
      if (!Number.isInteger(p) || p < 0 || p > 9) {
        issues.push({ path: `ref[${i}]`, message: `页号 ${p} 不在 0–9 范围内`, severity: "error" });
      }
    });
  }
  return issues;
}

const cloneSlots = (s: (number | null)[]) => [...s];

export const simulate: Simulator<ReplacementInput, ReplacementState, ReplacementEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as ReplacementInput;
  const frames: Frame<ReplacementState, ReplacementEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const pages = parseRef(input.ref);
  const capacity = input.frames;
  let slots: (number | null)[] = Array.from({ length: capacity }, () => null);
  let recency: number[] = [];
  const stats = { hits: 0, faults: 0 };
  const history: ColumnRecord[] = [];

  const push = (
    event: ReplacementEvent,
    narration: string,
    extra: Partial<Pick<ReplacementState, "current">> = {},
    size?: number,
  ) => {
    frames.push({
      index: frames.length,
      state: {
        slots: cloneSlots(slots),
        recency: [...recency],
        stats: { ...stats },
        accessed: history.length,
        alg: input.alg,
        history: history.map((h) => ({ ...h, frames: [...h.frames] })),
        ...extra,
      },
      event,
      narration,
      ...(size !== undefined ? { code: { file: "page_replace.cpp", line: size } } : {}),
    });
  };

  pages.forEach((page, column) => {
    const inMemory = slots.includes(page);
    // 先把当前列记进历史（此时还不知道是否要淘汰），后续步骤原地补全，
    // 这样「访问帧」上表格就有内容，不会出现「刚访问却显示没有记录」。
    history.push({ page, hit: inMemory, frames: cloneSlots(slots) });
    push(
      { type: "ACCESS", page, column, inMemory },
      `第 ${column + 1} 次访问页 ${page}${inMemory ? "：已在内存" : "：不在内存"}`,
      { current: { page, hit: inMemory } },
    );

    if (inMemory) {
      stats.hits += 1;
      const slot = slots.indexOf(page);
      recency = [...recency.filter((p) => p !== page), page];
      push({ type: "HIT", page, slot }, `命中：页 ${page} 在第 ${slot} 块，更新「最近使用」次序`, {
        current: { page, hit: true, slot },
      }, 9);
      return;
    }

    stats.faults += 1;
    const free = slots.indexOf(null);
    if (free >= 0) {
      slots[free] = page;
      recency = [...recency, page];
      history[history.length - 1]!.frames = cloneSlots(slots);
      push({ type: "FAULT", page, cause: "empty" }, `缺页：页 ${page} 不在内存，第 ${free} 块空闲 → 直接装入`, {
        current: { page, hit: false, slot: free },
      }, 11);
      push({ type: "LOAD", page, slot: free }, `装入第 ${free} 块`, { current: { page, hit: false, slot: free } }, 13);
      return;
    }

    // 需要淘汰
    let victim: number;
    let reason: "oldest" | "least-recent" | "farthest";
    if (input.alg === "FIFO") {
      victim = slots[0] as number;
      reason = "oldest";
    } else if (input.alg === "LRU") {
      victim = recency[0] as number;
      reason = "least-recent";
    } else {
      const future = pages.slice(column + 1);
      victim = slots[0] as number;
      let farthest = -1;
      for (const candidate of slots as number[]) {
        const nextUse = future.indexOf(candidate);
        const distance = nextUse === -1 ? Number.POSITIVE_INFINITY : nextUse;
        if (distance > farthest) {
          farthest = distance;
          victim = candidate;
        }
      }
      reason = "farthest";
    }

    const slot = slots.indexOf(victim);
    push(
      { type: "FAULT", page, cause: "full" },
      `缺页：页 ${page} 不在内存，且 ${capacity} 块已满 → 必须淘汰`,
      { current: { page, hit: false, victim } },
      11,
    );
    const why =
      reason === "oldest" ? "最早调入" : reason === "least-recent" ? "最久未使用" : "未来最长时间不会被访问";
    push({ type: "EVICT", victim, slot, reason }, `淘汰页 ${victim}（${why}）`, {
      current: { page, hit: false, victim, slot },
    }, 12);

    slots = slots.map((s) => (s === victim ? page : s));
    if (reason === "oldest") {
      slots = [...slots.filter((s) => s !== page), page].slice(0, capacity);
    }
    recency = [...recency.filter((p) => p !== victim), page];
    history[history.length - 1]!.victim = victim;
    history[history.length - 1]!.frames = cloneSlots(slots);
    push({ type: "LOAD", page, slot }, `把页 ${page} 装入刚空出的第 ${slot} 块`, {
      current: { page, hit: false, victim, slot },
    }, 13);
  });

  const rate = stats.faults / pages.length;
  push(
    { type: "DONE", hits: stats.hits, faults: stats.faults, rate },
    `结束：${pages.length} 次访问，命中 ${stats.hits}、缺页 ${stats.faults}，缺页率 ${(rate * 100).toFixed(1)}%`,
    {},
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: ReplacementInput = {
  ref: REF_PRESET,
  frames: 3,
  alg: "LRU",
};
