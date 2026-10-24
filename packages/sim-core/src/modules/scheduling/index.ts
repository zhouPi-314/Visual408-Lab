import type { SchedModule } from "./types";
import {
  ALGO_NAME,
  DEFAULT_PROCESSES,
  defaultInput,
  formatProcesses,
  meta,
  parseProcesses,
  simulate,
  validate,
} from "./sim";

export const module: SchedModule = { meta, defaultInput, simulate };
export { validate, parseProcesses, formatProcesses, ALGO_NAME, DEFAULT_PROCESSES };
export type { SchedInput, SchedState, SchedEvent, SchedProcess, SchedAlgorithm } from "./types";
