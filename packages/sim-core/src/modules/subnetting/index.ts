import type { SubnetModule } from "./types";
import { bitsToIp, defaultInput, meta, parseIp, simulate, toBits, validate } from "./sim";

export const module: SubnetModule = { meta, defaultInput, simulate };
export { validate, parseIp, toBits, bitsToIp };
export type { SubnetInput, SubnetState, SubnetEvent } from "./types";
