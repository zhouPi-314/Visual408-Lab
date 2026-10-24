import type { TreeModule } from "./types";
import {
  ORDER_NAME,
  PRESET_TREE,
  defaultInput,
  formatTree,
  left,
  meta,
  parseTreeInput,
  right,
  simulate,
  treeHeight,
  validate,
} from "./sim";

export const module: TreeModule = { meta, defaultInput, simulate };

export {
  validate,
  parseTreeInput,
  formatTree,
  treeHeight,
  left,
  right,
  ORDER_NAME,
  PRESET_TREE,
};
export type { TreeInput, TreeState, TreeEvent, TreeOrder, TraversalMode } from "./types";
