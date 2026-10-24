import type { TcpModule } from "./types";
import { STATE_ORDER, defaultInput, meta, simulate, validate } from "./sim";

export const module: TcpModule = { meta, defaultInput, simulate };
export { validate, STATE_ORDER };
export type { TcpInput, TcpState, TcpEvent, TcpPacket, TcpScenario, TcpConnState } from "./types";