import type { ModuleDefinition } from "../../protocol";

export type SortAlgorithm = "insertion" | "bubble" | "quick";

export interface SortInput {
  algorithm: SortAlgorithm;
  /** 逗号/空格分隔的整数（1–99） */
  data: string;
}

export interface SortState {
  algorithm: SortAlgorithm;
  /** 插入排序在「取出待插入值」时会在原位置留下一个空位（null） */
  array: (number | null)[];
  /** 已确定最终位置的区间（冒泡/插入的有序区，快排的已定位下标） */
  settled: number[];
  comparing?: [number, number];
  swapping?: [number, number];
  pivot?: number;
  /** 当前趟数（插入/冒泡），快排为递归深度 */
  pass: number;
  stats: { compares: number; moves: number };
  done: boolean;
  /** 插入排序当前空位下标 */
  hole?: number;
  /** 插入排序暂存在「手里」的待插入值 */
  keyValue?: number;
}

export type SortEvent =
  | { type: "START"; array: number[] }
  | { type: "COMPARE"; i: number; j: number }
  | { type: "SWAP"; i: number; j: number }
  | { type: "SHIFT"; from: number; to: number }
  | { type: "KEY"; index: number; value: number }
  | { type: "PIVOT"; index: number; value: number }
  | { type: "PASS"; pass: number }
  | { type: "DONE"; stats: { compares: number; moves: number } };

export type SortModule = ModuleDefinition<SortInput, SortState, SortEvent>;
