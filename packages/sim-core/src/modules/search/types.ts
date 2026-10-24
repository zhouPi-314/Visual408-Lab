import type { ModuleDefinition } from "../../protocol";

export type SearchMode = "sequential" | "binary";

export interface SearchInput {
  /** 逗号分隔的整数，折半查找要求升序 */
  data: string;
  target: number;
  mode: SearchMode;
}

export interface SearchState {
  mode: SearchMode;
  array: number[];
  target: number;
  low: number;
  high: number;
  mid?: number;
  compares: number;
  found?: number;
  /** 已经排除的区间标记，用于可视化 */
  eliminated: number[];
}

export type SearchEvent =
  | { type: "INIT"; target: number }
  | { type: "COMPARE"; index: number; value: number }
  | { type: "NARROW"; low: number; high: number }
  | { type: "FOUND"; index: number }
  | { type: "NOT_FOUND"; compares: number }
  | { type: "DONE"; compares: number };

export type SearchModule = ModuleDefinition<SearchInput, SearchState, SearchEvent>;
