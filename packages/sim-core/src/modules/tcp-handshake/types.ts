import type { ModuleDefinition } from "../../protocol";

export type TcpConnState =
  | "CLOSED"
  | "SYN_SENT"
  | "SYN_RCVD"
  | "ESTABLISHED"
  | "FIN_WAIT_1"
  | "FIN_WAIT_2"
  | "CLOSE_WAIT"
  | "CLOSING"
  | "LAST_ACK"
  | "TIME_WAIT";

export type TcpScenario = "normal" | "rst-refused" | "last-ack-lost" | "simultaneous-close";

export interface TcpInput {
  clientIsn: number;
  serverIsn: number;
  clientDataBytes: number;
  serverDataBytes: number;
  scenario: TcpScenario;
}

export interface TcpPacket {
  index: number;
  from: "C" | "S";
  flags: string;
  seq?: number;
  ack?: number;
  bytes?: number;
  lost?: boolean;
  /** 时间轴位置（单位：0.5 RTT） */
  at: number;
  note: string;
}

export interface TcpState {
  clientState: TcpConnState;
  serverState: TcpConnState;
  clientNextSeq: number;
  serverNextSeq: number;
  packets: TcpPacket[];
  clock: number;
  scenario: TcpScenario;
  /** 当步报文（便于高亮） */
  currentIndex?: number;
}

export type TcpEvent =
  | { type: "INIT" }
  | { type: "PACKET"; packet: TcpPacket }
  | { type: "TIMER"; label: string; duration: number }
  | { type: "DONE"; packets: number; elapsed: number };

export type TcpModule = ModuleDefinition<TcpInput, TcpState, TcpEvent>;