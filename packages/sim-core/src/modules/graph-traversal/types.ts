import type { ModuleDefinition } from "../../protocol";

export type GraphMode = "bfs" | "dfs";

export interface GraphInput {
  nodes: number;
  /** 边表，如 "0-1, 0-2, 1-3" */
  edges: string;
  start: number;
  mode: GraphMode;
}

export interface GraphState {
  n: number;
  matrix: number[][];
  adjacency: number[][];
  mode: GraphMode;
  visited: number[];
  /** BFS 队列 / DFS 栈（栈顶在右） */
  frontier: number[];
  current?: number;
  treeEdges: [number, number][];
}

export type GraphEvent =
  | { type: "INIT"; start: number }
  | { type: "ENQUEUE"; node: number }
  | { type: "DEQUEUE"; node: number }
  | { type: "PUSH"; node: number }
  | { type: "POP"; node: number }
  | { type: "VISIT"; node: number; order: number }
  | { type: "EDGE"; from: number; to: number }
  | { type: "DONE"; order: number[] };

export type GraphModule = ModuleDefinition<GraphInput, GraphState, GraphEvent>;
