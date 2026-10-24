import type { ModuleDefinition } from "../../protocol";

export type TreeOrder = "pre" | "in" | "post" | "level";
export type TraversalMode = "recursive" | "iterative";

export interface TreeInput {
  /** 层序数组，null 表示空位；下标 0 为根，i 的孩子是 2i+1 / 2i+2 */
  tree: (string | null)[];
  order: TreeOrder;
  mode: TraversalMode;
}

export interface TreeNodeRef {
  node: number;
  label: string;
}

export interface TreeState {
  order: TreeOrder;
  nodes: (string | null)[];
  /** 递归栈（层序时为空） */
  stack: TreeNodeRef[];
  /** 队列（仅层序） */
  queue: TreeNodeRef[];
  /** 访问序列 */
  visited: TreeNodeRef[];
  current?: number;
}

export type TreeEvent =
  | { type: "ENTER"; node: number; label: string }
  | { type: "EMIT"; node: number; label: string }
  | { type: "RETURN"; node: number; label: string }
  | { type: "ENQUEUE"; node: number; label: string }
  | { type: "DEQUEUE"; node: number; label: string }
  | { type: "DONE"; sequence: string[] };

export type TreeModule = ModuleDefinition<TreeInput, TreeState, TreeEvent>;
