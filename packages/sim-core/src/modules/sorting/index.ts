import type { SortModule } from "./types";
import { ALGO_NAME, DEFAULT_DATA, defaultInput, meta, parseData, simulate, validate } from "./sim";

export const module: SortModule = { meta, defaultInput, simulate };
export { validate, parseData, ALGO_NAME, DEFAULT_DATA };
export type { SortInput, SortState, SortEvent, SortAlgorithm } from "./types";
