import type { ModuleDefinition } from "../../protocol";

export interface SubnetInput {
  /** 点分十进制 IPv4 */
  ip: string;
  /** 前缀长度 0–32 */
  prefix: number;
}

export interface SubnetState {
  ip: string;
  prefix: number;
  ipBits: number[];
  maskBits: number[];
  networkBits: number[];
  broadcastBits: number[];
  mask: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  hostCount: number;
  /** 当前讲解到第几步（1 拆位 / 2 掩码 / 3 网络地址 / 4 广播地址 / 5 可用主机） */
  stage: number;
}

export type SubnetEvent =
  | { type: "BITS"; ip: string }
  | { type: "MASK"; prefix: number; mask: string }
  | { type: "NETWORK"; network: string }
  | { type: "BROADCAST"; broadcast: string }
  | { type: "HOSTS"; firstHost: string; lastHost: string; hostCount: number }
  | { type: "DONE" };

export type SubnetModule = ModuleDefinition<SubnetInput, SubnetState, SubnetEvent>;
