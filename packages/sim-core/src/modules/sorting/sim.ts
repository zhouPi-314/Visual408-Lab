import type { Frame, Issue, Simulator } from "../../protocol";
import type { SortAlgorithm, SortEvent, SortInput, SortState } from "./types";

const META = {
  id: "ds.sorting",
  subject: "ds" as const,
  title: "排序：插入 / 冒泡 / 快速",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·数据结构·内部排序", kind: "syllabus" as const },
    { label: "三种排序的逐趟推演（本项目原创实现）", kind: "original" as const },
  ],
};

export const ALGO_NAME: Record<SortAlgorithm, string> = {
  insertion: "直接插入排序",
  bubble: "冒泡排序",
  quick: "快速排序",
};

export const DEFAULT_DATA = "49, 38, 65, 97, 76, 13, 27";

export function parseData(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<SortInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (!["insertion", "bubble", "quick"].includes(String(v.algorithm))) {
    issues.push({ path: "algorithm", message: "算法只能是 insertion / bubble / quick", severity: "error" });
  }
  if (typeof v.data !== "string" || v.data.trim() === "") {
    issues.push({ path: "data", message: "数据不能为空", severity: "error" });
    return issues;
  }
  const data = parseData(v.data);
  if (data.length < 2) issues.push({ path: "data", message: "至少需要 2 个数", severity: "error" });
  if (data.length > 12) issues.push({ path: "data", message: "最多 12 个数（保证一屏可读）", severity: "error" });
  data.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      issues.push({ path: `data[${i}]`, message: `${n} 不是 1–99 的整数`, severity: "error" });
    }
  });
  return issues;
}

export const simulate: Simulator<SortInput, SortState, SortEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as SortInput;
  const frames: Frame<SortState, SortEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const a: (number | null)[] = parseData(input.data);
  const settled = new Set<number>();
  const stats = { compares: 0, moves: 0 };
  let comparing: [number, number] | undefined;
  let swapping: [number, number] | undefined;
  let pivot: number | undefined;
  let hole: number | undefined;
  let keyValue: number | undefined;
  let pass = 0;
  let done = false;

  const push = (event: SortEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: {
        algorithm: input.algorithm,
        array: [...a],
        settled: [...settled].sort((x, y) => x - y),
        ...(comparing ? { comparing } : {}),
        ...(swapping ? { swapping } : {}),
        ...(pivot !== undefined ? { pivot } : {}),
        ...(hole !== undefined ? { hole } : {}),
        ...(keyValue !== undefined ? { keyValue } : {}),
        pass,
        stats: { ...stats },
        done,
      },
      event,
      narration,
    });
  };

  push({ type: "START", array: [...a] as number[] }, `开始：${ALGO_NAME[input.algorithm]}，待排序列 ${a.join(", ")}`);

  const num = (i: number) => a[i] as number;
  const swapAt = (i: number, j: number) => {
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
    stats.moves += 2;
  };

  if (input.algorithm === "insertion") {
    for (let i = 1; i < a.length; i++) {
      pass = i;
      const key = num(i);
      a[i] = null;
      hole = i;
      keyValue = key;
      comparing = undefined;
      push({ type: "KEY", index: i, value: key }, `第 ${i} 趟：取出 a[${i}]=${key}（原位置空出），往前面有序区里插`);

      let j = i - 1;
      while (j >= 0) {
        comparing = [j, hole ?? j + 1];
        stats.compares += 1;
        push({ type: "COMPARE", i: j, j: hole ?? j + 1 }, `比较 a[${j}]=${num(j)} 与待插入值 ${key}`);
        if (num(j) <= key) break;
        a[j + 1] = a[j]!;
        a[j] = null;
        hole = j;
        stats.moves += 1;
        push({ type: "SHIFT", from: j, to: j + 1 }, `a[${j}]=${num(j + 1)} 后移一位，空位挪到 a[${j}]`);
        j -= 1;
      }
      comparing = undefined;
      a[j + 1] = key;
      stats.moves += 1;
      hole = undefined;
      keyValue = undefined;
      settled.add(j + 1);
      push({ type: "PASS", pass: i }, `把 ${key} 放进 a[${j + 1}]，前 ${i + 1} 个元素有序`);
    }
    for (let k = 0; k < a.length; k++) settled.add(k);
  } else if (input.algorithm === "bubble") {
    for (let p = 0; p < a.length - 1; p++) {
      pass = p + 1;
      let swapped = false;
      for (let j = 0; j < a.length - 1 - p; j++) {
        comparing = [j, j + 1];
        stats.compares += 1;
        push({ type: "COMPARE", i: j, j: j + 1 }, `比较 a[${j}]=${num(j)} 与 a[${j + 1}]=${num(j + 1)}`);
        if (num(j) > num(j + 1)) {
          swapping = [j, j + 1];
          swapAt(j, j + 1);
          push({ type: "SWAP", i: j, j: j + 1 }, `逆序 → 交换，数组变成 ${a.join(", ")}`);
          swapping = undefined;
          swapped = true;
        }
      }
      if (!swapped) {
        for (let k = 0; k < a.length; k++) settled.add(k);
        push({ type: "PASS", pass }, `第 ${pass} 趟没有发生交换 → 已经有序，提前结束`);
        break;
      }
      settled.add(a.length - 1 - p);
      push({ type: "PASS", pass }, `第 ${pass} 趟结束，a[${a.length - 1 - p}]=${num(a.length - 1 - p)} 已经就位`);
    }
  } else {
    const quick = (lo: number, hi: number, depth: number) => {
      if (lo >= hi) {
        if (lo === hi) settled.add(lo);
        return;
      }
      pass = depth;
      pivot = hi;
      const pivotValue = num(hi);
      push({ type: "PIVOT", index: hi, value: pivotValue }, `以 a[${hi}]=${pivotValue} 为枢轴，划分 [${lo}, ${hi}]`);
      let i = lo;
      for (let j = lo; j < hi; j++) {
        comparing = [j, hi];
        stats.compares += 1;
        push({ type: "COMPARE", i: j, j: hi }, `比较 a[${j}]=${num(j)} 与枢轴 ${pivotValue}`);
        if (num(j) < pivotValue) {
          if (i !== j) {
            swapping = [i, j];
            swapAt(i, j);
            push({ type: "SWAP", i, j }, `小于枢轴 → 交换到左区，数组变成 ${a.join(", ")}`);
            swapping = undefined;
          }
          i += 1;
        }
      }
      comparing = undefined;
      if (i !== hi) {
        swapping = [i, hi];
        swapAt(i, hi);
        push({ type: "SWAP", i, j: hi }, `把枢轴放到最终位置 a[${i}]`);
        swapping = undefined;
      }
      settled.add(i);
      pivot = undefined;
      push({ type: "PASS", pass: depth }, `枢轴 ${pivotValue} 定位在 a[${i}]，左边都比它小、右边都比它大`);
      quick(lo, i - 1, depth + 1);
      quick(i + 1, hi, depth + 1);
    };
    quick(0, a.length - 1, 1);
    for (let k = 0; k < a.length; k++) settled.add(k);
  }

  done = true;
  comparing = undefined;
  swapping = undefined;
  pivot = undefined;
  hole = undefined;
  keyValue = undefined;
  push(
    { type: "DONE", stats: { ...stats } },
    `结束：${a.join(", ")}，共比较 ${stats.compares} 次、移动 ${stats.moves} 次`,
  );
  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: SortInput = { algorithm: "insertion", data: DEFAULT_DATA };
