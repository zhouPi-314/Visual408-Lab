import type { CacheModule } from "./types";
import { defaultInput, meta, simulate, validate } from "./sim";

export const module: CacheModule = {
  meta,
  defaultInput,
  simulate,
};

export { validate };
export { createCore, decodeAddr, probeCache, log2 } from "./core";
export type { CacheParams, CacheCore, DecodedAddress, ProbeResult } from "./core";
export type { CacheInput, CacheState, CacheEvent } from "./types";
