import type { Frame, Issue, Simulator } from "../../protocol";
import type { SearchEvent, SearchInput, SearchMode, SearchState } from "./types";

const META = {
  id: "ds.search",
  subject: "ds" as const,
  title: "查找：顺序 / 折半",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·数据结构·查找", kind: "syllabus" as const },
    { label: "折半查找的区间收缩推演（本项目原创实现）", kind: "original" as const },
  ],
};

export const MODE_NAME: Record<SearchMode, string> = { sequential: "顺序查找", binary: "折半查找" };

export function parseData(raw: string): number[] {
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map(Number);
}

export const defaultInput: SearchInput = { data: "1, 3, 5, 7, 9, 11", target: 7, mode: "binary" };

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<SearchInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (v.mode !== "sequential" && v.mode !== "binary") {
    issues.push({ path: "mode", message: "查找方式只能是 sequential / binary", severity: "error" });
  }
  if (typeof v.data !== "string" || v.data.trim() === "") {
    issues.push({ path: "data", message: "数据不能为空", severity: "error" });
    return issues;
  }
  const data = parseData(v.data);
  if (data.length < 2) issues.push({ path: "data", message: "至少需要 2 个元素", severity: "error" });
  if (data.length > 12) issues.push({ path: "data", message: "最多 12 个元素", severity: "error" });
  data.forEach((n, i) => {
    if (!Number.isInteger(n)) issues.push({ path: `data[${i}]`, message: `${n} 不是整数`, severity: "error" });
  });
  if (!Number.isInteger(v.target)) {
    issues.push({ path: "target", message: "目标值必须是整数", severity: "error" });
  }
  if (v.mode === "binary") {
    const sorted = [...data].every((n, i) => i === 0 || n >= data[i - 1]!);
    if (!sorted) {
      issues.push({ path: "data", message: "折半查找要求数据升序排列", severity: "error" });
    }
  }
  return issues;
}

export const simulate: Simulator<SearchInput, SearchState, SearchEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as SearchInput;
  const frames: Frame<SearchState, SearchEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const array = parseData(input.data);
  let low = 0;
  let high = array.length - 1;
  let mid: number | undefined;
  let compares = 0;
  let found: number | undefined;
  const eliminated: number[] = [];

  const push = (event: SearchEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: {
        mode: input.mode,
        array: [...array],
        target: input.target,
        low,
        high,
        ...(mid !== undefined ? { mid } : {}),
        compares,
        ...(found !== undefined ? { found } : {}),
        eliminated: [...eliminated],
      },
      event,
      narration,
    });
  };

  push({ type: "INIT", target: input.target }, `${MODE_NAME[input.mode]}：在 ${array.length} 个元素中找 ${input.target}`);

  if (input.mode === "sequential") {
    for (let i = 0; i < array.length; i++) {
      mid = i;
      compares += 1;
      push({ type: "COMPARE", index: i, value: array[i]! }, `比较第 ${i + 1} 个元素 ${array[i]} 与 ${input.target}`);
      if (array[i] === input.target) {
        found = i;
        push({ type: "FOUND", index: i }, `找到 ${input.target}，位置 ${i}（比较 ${compares} 次）`);
        break;
      }
      eliminated.push(i);
      push({ type: "NARROW", low: i + 1, high }, `不相等，排除第 ${i + 1} 个`);
    }
    if (found === undefined) push({ type: "NOT_FOUND", compares }, `查找失败，共比较 ${compares} 次`);
  } else {
    while (low <= high) {
      mid = Math.floor((low + high) / 2);
      compares += 1;
      push({ type: "COMPARE", index: mid, value: array[mid]! }, `区间 [${low}, ${high}] → mid=${mid}，比较 ${array[mid]} 与 ${input.target}`);
      if (array[mid] === input.target) {
        found = mid;
        push({ type: "FOUND", index: mid }, `找到 ${input.target}，位置 ${mid}（比较 ${compares} 次）`);
        break;
      }
      if (array[mid]! < input.target) {
        for (let k = low; k <= mid; k++) eliminated.push(k);
        low = mid + 1;
        push({ type: "NARROW", low, high }, `${array[mid]} < ${input.target} → 只可能在右半区 [${low}, ${high}]`);
      } else {
        for (let k = mid; k <= high; k++) eliminated.push(k);
        high = mid - 1;
        push({ type: "NARROW", low, high }, `${array[mid]} > ${input.target} → 只可能在左半区 [${low}, ${high}]`);
      }
    }
    mid = undefined;
    if (found === undefined) push({ type: "NOT_FOUND", compares }, `查找失败，共比较 ${compares} 次`);
  }

  push({ type: "DONE", compares }, `结束：${found === undefined ? "未找到" : `位置 ${found}`}，比较 ${compares} 次`);
  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;
