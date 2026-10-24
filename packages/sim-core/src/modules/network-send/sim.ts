import type { Frame, Issue, Simulator } from "../../protocol";
import { bitsToIp, parseIp, toBits } from "../subnetting/sim";
import type { FragmentInfo, PacketInfo, SegmentInfo, SendEvent, SendInput, SendState } from "./types";

const META = {
  id: "cross.network-send-chain",
  subject: "cross" as const,
  title: "网络数据发送链路",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·计算机网络·传输层/网络层/链路层 + 操作系统·缓冲", kind: "syllabus" as const },
    { label: "跨层发送链路组合实验（本项目原创）", kind: "original" as const },
  ],
};

export const STAGES = [
  { id: 1, label: "应用写入" },
  { id: 2, label: "TCP 分段" },
  { id: 3, label: "IP 封装" },
  { id: 4, label: "路由判断" },
  { id: 5, label: "ARP 解析" },
  { id: 6, label: "成帧发送" },
] as const;

const TCP_HEADER = 20;
const IP_HEADER = 20;
const ETH_HEADER = 14;
const ETH_FCS = 4;

export const defaultInput: SendInput = {
  dataBytes: 3000,
  mss: 1460,
  mtu: 1500,
  srcIp: "192.168.10.10",
  dstIp: "192.168.20.50",
  prefix: 24,
  gateway: "192.168.10.1",
  ttl: 64,
};

export function networkOf(ip: string, prefix: number): string {
  const bits = toBits(parseIp(ip)!);
  return bitsToIp(bits.map((b, i) => (i < prefix ? b : 0)));
}

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<SendInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];

  if (!Number.isInteger(v.dataBytes) || (v.dataBytes as number) < 1 || (v.dataBytes as number) > 20000) {
    issues.push({ path: "dataBytes", message: "数据量必须是 1–20000 字节", severity: "error" });
  }
  if (!Number.isInteger(v.mss) || (v.mss as number) < 1 || (v.mss as number) > 9000) {
    issues.push({ path: "mss", message: "MSS 必须是 1–9000", severity: "error" });
  }
  if (!Number.isInteger(v.mtu) || (v.mtu as number) < 68 || (v.mtu as number) > 9000) {
    issues.push({ path: "mtu", message: "MTU 必须是 68–9000", severity: "error" });
  }
  for (const key of ["srcIp", "dstIp", "gateway"] as const) {
    if (typeof v[key] !== "string" || parseIp(v[key] as string) === null) {
      issues.push({ path: key, message: "必须是合法的点分十进制 IPv4", severity: "error" });
    }
  }
  if (!Number.isInteger(v.prefix) || (v.prefix as number) < 0 || (v.prefix as number) > 32) {
    issues.push({ path: "prefix", message: "前缀长度必须是 0–32", severity: "error" });
  }
  if (!Number.isInteger(v.ttl) || (v.ttl as number) < 1 || (v.ttl as number) > 255) {
    issues.push({ path: "ttl", message: "TTL 必须是 1–255", severity: "error" });
  }
  return issues;
}

/** 分片载荷必须是 8 的整数倍 */
function fragmentPayload(mtu: number): number {
  const max = mtu - IP_HEADER;
  return Math.max(8, Math.floor(max / 8) * 8);
}

export const simulate: Simulator<SendInput, SendState, SendEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as SendInput;
  const frames: Frame<SendState, SendEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  // 1. TCP 分段
  const segments: SegmentInfo[] = [];
  let sent = 0;
  let seq = 1;
  while (sent < input.dataBytes) {
    const bytes = Math.min(input.mss, input.dataBytes - sent);
    segments.push({ index: segments.length, bytes, seqStart: seq, seqEnd: seq + bytes - 1 });
    seq += bytes;
    sent += bytes;
  }

  // 2. IP 封装（每段一个 IP 包）
  const packets: PacketInfo[] = segments.map((s) => ({
    index: s.index,
    payload: s.bytes,
    total: s.bytes + TCP_HEADER + IP_HEADER,
  }));

  // 3. 路由判断（复用子网模块的按位与）
  const srcNetwork = networkOf(input.srcIp, input.prefix);
  const dstNetwork = networkOf(input.dstIp, input.prefix);
  const sameSubnet = srcNetwork === dstNetwork;
  const nextHop = sameSubnet ? input.dstIp : input.gateway;
  const arpTarget = nextHop;
  const dstMac = sameSubnet ? "aa:bb:cc:00:00:03" : "aa:bb:cc:00:00:02";

  // 4. 分片
  const needsFragmentation = packets.some((p) => p.total > input.mtu);
  const fragments: FragmentInfo[] = [];
  if (needsFragmentation) {
    const per = fragmentPayload(input.mtu);
    for (const p of packets) {
      let offset = 0;
      while (offset < p.payload) {
        const bytes = Math.min(per, p.payload - offset);
        fragments.push({ index: fragments.length, offset, bytes, more: offset + bytes < p.payload });
        offset += bytes;
      }
    }
  }

  const totalWire =
    packets.reduce((acc, p) => acc + p.total, 0) +
    (needsFragmentation ? fragments.length - packets.length : 0) * IP_HEADER +
    packets.length * (ETH_HEADER + ETH_FCS);
  const overhead = totalWire - input.dataBytes;

  const base: Omit<SendState, "stage"> = {
    input,
    segments,
    packets,
    fragments,
    sameSubnet,
    srcNetwork,
    dstNetwork,
    nextHop,
    arpTarget,
    dstMac,
    overhead,
    needsFragmentation,
  };

  const push = (event: SendEvent, narration: string, stage: number) => {
    frames.push({ index: frames.length, state: { ...base, stage }, event, narration });
  };

  push({ type: "APP", bytes: input.dataBytes }, `应用层写入 ${input.dataBytes} 字节，交给 TCP`, 1);

  for (const s of segments) {
    push(
      { type: "TCP_SEGMENT", segment: s, total: segments.length },
      `TCP 分段 ${s.index + 1}/${segments.length}：${s.bytes} 字节，序号 ${s.seqStart}–${s.seqEnd}，加 20 字节 TCP 头`,
      2,
    );
  }

  for (const p of packets) {
    push(
      { type: "IP_PACKET", packet: p },
      `IP 封装：载荷 ${p.payload} + TCP 头 20 + IP 头 20 = ${p.total} 字节，TTL=${input.ttl}`,
      3,
    );
  }

  push(
    {
      type: "ROUTE",
      sameSubnet,
      srcNetwork,
      dstNetwork,
      nextHop,
    },
    sameSubnet
      ? `路由：${input.dstIp} 与本机同属 ${srcNetwork}/${input.prefix} → 直接投递，下一跳就是目标主机`
      : `路由：目的 ${input.dstIp} 属于 ${dstNetwork}/${input.prefix}，与本机 ${srcNetwork}/${input.prefix} 不同 → 交给网关 ${input.gateway}`,
    4,
  );

  push(
    { type: "ARP", target: arpTarget, sameSubnet },
    sameSubnet
      ? `ARP：广播询问 ${arpTarget} 的 MAC（同子网，问的就是目的主机）`
      : `ARP：广播询问网关 ${arpTarget} 的 MAC（跨子网只解析网关，不需要知道最终主机的 MAC）`,
    5,
  );

  push(
    { type: "FRAME", dstMac, payload: packets[0]!.total },
    `成帧：目的 MAC ${dstMac}，类型 0x0800，外加 14 字节以太网头与 4 字节 FCS`,
    6,
  );

  if (needsFragmentation) {
    for (const f of fragments) {
      push(
        { type: "FRAGMENT", fragment: f, total: fragments.length },
        `分片 ${f.index + 1}/${fragments.length}：偏移 ${f.offset} 字节，载荷 ${f.bytes}，MF=${f.more ? 1 : 0}`,
        6,
      );
    }
  }

  push(
    { type: "SEND", packets: packets.length, totalBytes: totalWire, overhead },
    needsFragmentation
      ? `发送完成：${packets.length} 个 IP 包被分成 ${fragments.length} 个分片，链路上共 ${totalWire} 字节（其中头部 ${overhead} 字节）`
      : `发送完成：${packets.length} 个包，链路上共 ${totalWire} 字节（有效载荷 ${input.dataBytes}，头部开销 ${overhead}）`,
    6,
  );
  push({ type: "DONE" }, `小结：先分段（TCP）再封装（IP），链路层只负责相邻一跳；跨子网时目的 MAC 是网关`, 6);

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;
