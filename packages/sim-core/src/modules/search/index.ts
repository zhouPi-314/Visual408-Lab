import type { SearchModule } from "./types";
import { MODE_NAME, defaultInput, meta, parseData, simulate, validate } from "./sim";

export const module: SearchModule = { meta, defaultInput, simulate };
export { validate, parseData, MODE_NAME };
export type { SearchInput, SearchState, SearchEvent, SearchMode } from "./types";
