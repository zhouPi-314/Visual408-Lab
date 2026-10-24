import type { ModuleDefinition } from "../../protocol";

export interface SendInput {
  /** 应用层要发送的字节数 */
  dataBytes: number;
  /** TCP 最大报文段长度 MSS */
  mss: number;
  /** 链路 MTU */
  mtu: number;
  /** 源/目的 IP 与前缀（同一前缀用于判断是否同子网） */
  srcIp: string;
  dstIp: string;
  prefix: number;
  /** 网关（跨子网时作为下一跳） */
  gateway: string;
  ttl: number;
}

export interface SegmentInfo {
  index: number;
  bytes: number;
  seqStart: number;
  seqEnd: number;
}

export interface PacketInfo {
  index: number;
  payload: number;
  total: number;
}

export interface FragmentInfo {
  index: number;
  offset: number;
  bytes: number;
  more: boolean;
}

export interface SendState {
  input: SendInput;
  stage: number;
  segments: SegmentInfo[];
  packets: PacketInfo[];
  fragments: FragmentInfo[];
  sameSubnet: boolean;
  srcNetwork: string;
  dstNetwork: string;
  nextHop: string;
  arpTarget: string;
  dstMac: string;
  overhead: number;
  /** 每个 IP 包是否超过 MTU，需要分片 */
  needsFragmentation: boolean;
}

export type SendEvent =
  | { type: "APP"; bytes: number }
  | { type: "TCP_SEGMENT"; segment: SegmentInfo; total: number }
  | { type: "IP_PACKET"; packet: PacketInfo }
  | { type: "ROUTE"; sameSubnet: boolean; srcNetwork: string; dstNetwork: string; nextHop: string }
  | { type: "ARP"; target: string; sameSubnet: boolean }
  | { type: "FRAME"; dstMac: string; payload: number }
  | { type: "FRAGMENT"; fragment: FragmentInfo; total: number }
  | { type: "SEND"; packets: number; totalBytes: number; overhead: number }
  | { type: "DONE" };

export type SendModule = ModuleDefinition<SendInput, SendState, SendEvent>;
