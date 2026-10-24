import type { GraphModule } from "./types";
import { DEFAULT_EDGES, MODE_NAME, buildMatrix, defaultInput, meta, parseEdges, simulate, validate } from "./sim";

export const module: GraphModule = { meta, defaultInput, simulate };
export { validate, parseEdges, buildMatrix, MODE_NAME, DEFAULT_EDGES };
export type { GraphInput, GraphState, GraphEvent, GraphMode } from "./types";
