import type { Frame, Issue, Simulator } from "../../protocol";
import type { GraphEvent, GraphInput, GraphMode, GraphState } from "./types";

const META = {
  id: "ds.graph-traversal",
  subject: "ds" as const,
  title: "图的遍历：BFS / DFS",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·数据结构·图", kind: "syllabus" as const },
    { label: "邻接矩阵上的 BFS/DFS 推演（本项目原创实现）", kind: "original" as const },
  ],
};

export const MODE_NAME: Record<GraphMode, string> = { bfs: "广度优先 BFS", dfs: "深度优先 DFS" };

export const DEFAULT_EDGES = "0-1, 0-2, 1-3, 2-3, 3-4";
export const defaultInput: GraphInput = { nodes: 5, edges: DEFAULT_EDGES, start: 0, mode: "bfs" };

export function parseEdges(raw: string): [number, number][] {
  return raw
    .split(/[;,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split("-").map(Number);
      return [a, b] as [number, number];
    });
}

export function buildMatrix(n: number, edges: [number, number][]): number[][] {
  const m = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (const [a, b] of edges) {
    if (a >= 0 && a < n && b >= 0 && b < n) {
      m[a]![b] = 1;
      m[b]![a] = 1;
    }
  }
  return m;
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<GraphInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (!Number.isInteger(v.nodes) || (v.nodes as number) < 2 || (v.nodes as number) > 8) {
    issues.push({ path: "nodes", message: "结点数必须是 2–8", severity: "error" });
    return issues;
  }
  if (v.mode !== "bfs" && v.mode !== "dfs") {
    issues.push({ path: "mode", message: "遍历方式只能是 bfs / dfs", severity: "error" });
  }
  if (!Number.isInteger(v.start) || (v.start as number) < 0 || (v.start as number) >= (v.nodes as number)) {
    issues.push({ path: "start", message: "起点必须在 0 到 n−1 之间", severity: "error" });
  }
  if (typeof v.edges !== "string") {
    issues.push({ path: "edges", message: "边表必须是字符串", severity: "error" });
  } else {
    parseEdges(v.edges).forEach(([a, b], i) => {
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        issues.push({ path: `edges[${i}]`, message: "每条边必须是 a-b 形式", severity: "error" });
      } else if (a < 0 || a >= (v.nodes as number) || b < 0 || b >= (v.nodes as number)) {
        issues.push({ path: `edges[${i}]`, message: `边 ${a}-${b} 超出结点范围`, severity: "error" });
      }
    });
  }
  return issues;
}

const clone2 = (m: number[][]) => m.map((r) => [...r]);

export const simulate: Simulator<GraphInput, GraphState, GraphEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as GraphInput;
  const frames: Frame<GraphState, GraphEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const n = input.nodes;
  const matrix = buildMatrix(n, parseEdges(input.edges));
  const adjacency = matrix.map((row) => row.flatMap((v, j) => (v ? [j] : [])));

  const visited: number[] = [];
  const treeEdges: [number, number][] = [];
  let frontier: number[] = [];
  let current: number | undefined;

  const push = (event: GraphEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: {
        n,
        matrix: clone2(matrix),
        adjacency: adjacency.map((r) => [...r]),
        mode: input.mode,
        visited: [...visited],
        frontier: [...frontier],
        ...(current !== undefined ? { current } : {}),
        treeEdges: treeEdges.map((e) => [...e] as [number, number]),
      },
      event,
      narration,
    });
  };

  push({ type: "INIT", start: input.start }, `${MODE_NAME[input.mode]}：从结点 ${input.start} 出发`);

  if (input.mode === "bfs") {
    const seen = new Set<number>([input.start]);
    frontier = [input.start];
    push({ type: "ENQUEUE", node: input.start }, `结点 ${input.start} 入队`);
    while (frontier.length > 0) {
      const u = frontier.shift()!;
      push({ type: "DEQUEUE", node: u }, `结点 ${u} 出队`);
      visited.push(u);
      current = u;
      push({ type: "VISIT", node: u, order: visited.length }, `访问 ${u}（第 ${visited.length} 个）`);
      for (const v of adjacency[u]!) {
        if (seen.has(v)) continue;
        seen.add(v);
        treeEdges.push([u, v]);
        push({ type: "EDGE", from: u, to: v }, `发现未访问的 ${v}：记录边 ${u}-${v}`);
        frontier.push(v);
        push({ type: "ENQUEUE", node: v }, `结点 ${v} 入队`);
      }
    }
  } else {
    const visitedSet = new Set<number>();
    frontier = [input.start];
    push({ type: "PUSH", node: input.start }, `结点 ${input.start} 入栈`);
    while (frontier.length > 0) {
      const u = frontier.pop()!;
      push({ type: "POP", node: u }, `结点 ${u} 出栈`);
      if (visitedSet.has(u)) continue;
      visitedSet.add(u);
      visited.push(u);
      current = u;
      push({ type: "VISIT", node: u, order: visited.length }, `访问 ${u}（第 ${visited.length} 个）`);
      // 逆序压栈，保证按邻接点编号从小到大的顺序出栈
      for (const v of [...adjacency[u]!].reverse()) {
        if (visitedSet.has(v)) continue;
        treeEdges.push([u, v]);
        push({ type: "EDGE", from: u, to: v }, `记录边 ${u}-${v}，${v} 稍后访问`);
        frontier.push(v);
        push({ type: "PUSH", node: v }, `结点 ${v} 入栈`);
      }
    }
  }

  push({ type: "DONE", order: [...visited] }, `遍历结束：${visited.join(" → ")}`);
  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;
