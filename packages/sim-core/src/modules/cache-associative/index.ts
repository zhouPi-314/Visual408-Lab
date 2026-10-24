import type { AssocModule } from "./types";
import { defaultInput, meta, simulate, validate } from "./sim";

export const module: AssocModule = { meta, defaultInput, simulate };
export { validate };
export type { AssocInput, AssocState, AssocEvent } from "./types";
