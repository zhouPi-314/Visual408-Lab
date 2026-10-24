import type { ReplacementModule } from "./types";
import { BELADY_PRESET, REF_PRESET, defaultInput, meta, parseRef, simulate, validate } from "./sim";

export const module: ReplacementModule = { meta, defaultInput, simulate };

export { validate, parseRef, REF_PRESET, BELADY_PRESET };
export type { ReplacementInput, ReplacementState, ReplacementEvent, ReplacementAlg } from "./types";
