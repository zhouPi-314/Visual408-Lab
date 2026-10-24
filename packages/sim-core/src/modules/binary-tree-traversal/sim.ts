import type { Frame, Issue, Simulator } from "../../protocol";
import type { TreeEvent, TreeInput, TreeOrder, TreeState } from "./types";

const META = {
  id: "ds.binary-tree-traversal",
  subject: "ds" as const,
  title: "二叉树遍历与递归栈",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·数据结构·树与二叉树", kind: "syllabus" as const },
    { label: "三种遍历的递归栈过程（本项目原创实现）", kind: "original" as const },
  ],
};

export const PRESET_TREE: (string | null)[] = ["A", "B", "C", "D", "E", null, "F"];

// 与 content/ds/binary-tree-traversal/examples/traversal.cpp 的真实行号对齐
const CODE = { ENTER: 7, EMIT: 9, RETURN: 12 };

export const left = (i: number) => 2 * i + 1;
export const right = (i: number) => 2 * i + 2;
export const depthOf = (i: number) => Math.floor(Math.log2(i + 1));

/** 树的深度（空树为 0） */
export function treeHeight(tree: (string | null)[]): number {
  let max = -1;
  tree.forEach((v, i) => {
    if (v !== null && i > max) max = i;
  });
  return max < 0 ? 0 : depthOf(max) + 1;
}

export function parseTreeInput(raw: string): (string | null)[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (s === "_" || s === "null" || s === "-" ? null : s));
}

export function formatTree(tree: (string | null)[]): string {
  return tree.map((v) => (v === null ? "_" : v)).join(", ");
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const value = input as Partial<TreeInput> | null;
  if (!value || typeof value !== "object") {
    return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  }
  if (!["pre", "in", "post", "level"].includes(String(value.order))) {
    issues.push({ path: "order", message: "遍历序只能是 pre / in / post / level", severity: "error" });
  }
  if (value.mode !== "recursive" && value.mode !== "iterative") {
    issues.push({ path: "mode", message: "模式只能是 recursive 或 iterative", severity: "error" });
  }
  if (value.order === "level" && value.mode === "recursive") {
    issues.push({ path: "mode", message: "层序遍历用的是队列，请选择 iterative", severity: "error" });
  }
  if (!Array.isArray(value.tree)) {
    issues.push({ path: "tree", message: "树必须用层序数组表示", severity: "error" });
    return issues;
  }
  const tree = value.tree as (string | null)[];
  if (tree.length > 31) {
    issues.push({ path: "tree", message: "最多 31 个结点（5 层）", severity: "error" });
  }
  if (tree.length > 0 && tree[0] === null) {
    issues.push({ path: "tree[0]", message: "根结点不能为空", severity: "error" });
  }
  const seen = new Set<string>();
  tree.forEach((v, i) => {
    if (v === null) return;
    if (typeof v !== "string" || v.trim() === "") {
      issues.push({ path: `tree[${i}]`, message: "结点值必须是非空字符串", severity: "error" });
      return;
    }
    if (seen.has(v)) {
      issues.push({ path: `tree[${i}]`, message: `结点值「${v}」重复，遍历结果将无法判定`, severity: "error" });
    }
    seen.add(v);
    if (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (tree[parent] === null) {
        issues.push({ path: `tree[${i}]`, message: "父结点为空，该结点是悬空的", severity: "error" });
      }
    }
  });
  if (tree.length === 0) {
    issues.push({ path: "tree", message: "空树：没有可访问的结点", severity: "warning" });
  }
  return issues;
}

const clone = <T,>(xs: T[]): T[] => xs.map((x) => (typeof x === "object" && x !== null ? { ...(x as object) } as T : x));

export const simulate: Simulator<TreeInput, TreeState, TreeEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as TreeInput;
  const frames: Frame<TreeState, TreeEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const tree = input.tree;
  const order = input.order;
  const label = (i: number) => String(tree[i] ?? "");

  // 1) 先按遍历序生成事件流（递归栈语义由事件序列本身表达）
  const events: TreeEvent[] = [];
  if (tree.length === 0) {
    // 空树：只给一帧提示
  } else if (order === "level") {
    const walk = (i: number) => {
      events.push({ type: "DEQUEUE", node: i, label: label(i) });
      events.push({ type: "EMIT", node: i, label: label(i) });
      for (const child of [left(i), right(i)]) {
        if (child < tree.length && tree[child] !== null) {
          events.push({ type: "ENQUEUE", node: child, label: label(child) });
        }
      }
    };
    events.push({ type: "ENQUEUE", node: 0, label: label(0) });
    // 用显式队列生成事件，保证与真实 BFS 顺序一致
    const queue: number[] = [0];
    events.length = 1;
    while (queue.length > 0) {
      const i = queue.shift() as number;
      events.push({ type: "DEQUEUE", node: i, label: label(i) });
      events.push({ type: "EMIT", node: i, label: label(i) });
      for (const child of [left(i), right(i)]) {
        if (child < tree.length && tree[child] !== null) {
          queue.push(child);
          events.push({ type: "ENQUEUE", node: child, label: label(child) });
        }
      }
    }
  } else {
    const walk = (i: number) => {
      if (i >= tree.length || tree[i] === null) return;
      events.push({ type: "ENTER", node: i, label: label(i) });
      if (order === "pre") events.push({ type: "EMIT", node: i, label: label(i) });
      walk(left(i));
      if (order === "in") events.push({ type: "EMIT", node: i, label: label(i) });
      walk(right(i));
      if (order === "post") events.push({ type: "EMIT", node: i, label: label(i) });
      events.push({ type: "RETURN", node: i, label: label(i) });
    };
    walk(0);
  }

  // 2) 按事件流推进状态，逐帧快照
  let stack: TreeState["stack"] = [];
  let queue: TreeState["queue"] = [];
  const visited: TreeState["visited"] = [];

  const push = (event: TreeEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: {
        order,
        nodes: tree,
        stack: clone(stack),
        queue: clone(queue),
        visited: clone(visited),
        ...(event.type === "DONE" ? {} : { current: event.node }),
      },
      event,
      narration,
      ...(event.type in CODE ? { code: { file: "traversal.cpp", line: CODE[event.type as keyof typeof CODE] } } : {}),
    });
  };

  if (tree.length === 0) {
    push({ type: "DONE", sequence: [] }, "空树：没有可访问的结点");
    return { input, meta: META, frames, validate: () => issues };
  }

  for (const event of events) {
    switch (event.type) {
      case "ENTER":
        stack = [...stack, { node: event.node, label: event.label }];
        push(event, `进入结点 ${event.label}：递归调用，压栈（当前深度 ${stack.length}）`);
        break;
      case "EMIT":
        visited.push({ node: event.node, label: event.label });
        push(event, `访问结点 ${event.label}：第 ${visited.length} 个出序列`);
        break;
      case "RETURN":
        stack = stack.filter((_, i) => i !== stack.length - 1);
        push(event, `离开结点 ${event.label}：函数返回，出栈（剩余 ${stack.length} 层）`);
        break;
      case "ENQUEUE":
        queue = [...queue, { node: event.node, label: event.label }];
        push(event, `结点 ${event.label} 入队（队列长度 ${queue.length}）`);
        break;
      case "DEQUEUE":
        queue = queue.filter((_, i) => i !== 0);
        push(event, `结点 ${event.label} 出队`);
        break;
      default:
        break;
    }
  }

  const sequence = visited.map((v) => v.label);
  push({ type: "DONE", sequence }, `遍历结束：${ORDER_NAME[order]} = ${sequence.join(" ")}`);
  return { input, meta: META, frames, validate: () => issues };
};

export const ORDER_NAME: Record<TreeOrder, string> = {
  pre: "先序",
  in: "中序",
  post: "后序",
  level: "层序",
};

export const meta = META;

export const defaultInput: TreeInput = { tree: PRESET_TREE, order: "pre", mode: "recursive" };
