import type { CrossModule } from "./types";
import { DEFAULT_ACCESSES, DEFAULT_PAGE_TABLE, STAGES, defaultInput, meta, simulate, validate } from "./sim";

export const module: CrossModule = { meta, defaultInput, simulate };
export { validate, STAGES, DEFAULT_PAGE_TABLE, DEFAULT_ACCESSES };
export type { CrossInput, CrossState, CrossEvent, CrossStats } from "./types";
