import type { SendModule } from "./types";
import { STAGES, defaultInput, meta, networkOf, simulate, validate } from "./sim";

export const module: SendModule = { meta, defaultInput, simulate };
export { validate, networkOf, STAGES };
export type { SendInput, SendState, SendEvent, SegmentInfo, PacketInfo, FragmentInfo } from "./types";
