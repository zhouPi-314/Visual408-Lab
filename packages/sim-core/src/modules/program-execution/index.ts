import type { ExecModule } from "./types";
import {
  PIPELINE_STAGES,
  STAGES,
  buildInstructions,
  defaultInput,
  isLoadUse,
  meta,
  simulate,
  validate,
} from "./sim";

export const module: ExecModule = { meta, defaultInput, simulate };
export { validate, STAGES, PIPELINE_STAGES, buildInstructions, isLoadUse };
export type { ExecInput, ExecState, ExecEvent, AsmInstruction, PipeCell } from "./types";
