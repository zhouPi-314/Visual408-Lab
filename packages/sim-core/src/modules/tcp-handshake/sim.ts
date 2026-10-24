import type { Frame, Issue, Simulator } from "../../protocol";
import type { TcpConnState, TcpEvent, TcpInput, TcpPacket, TcpScenario, TcpState } from "./types";

const META = {
  id: "net.tcp-handshake",
  subject: "net" as const,
  title: "TCP 连接建立与释放",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·计算机网络·传输层", kind: "syllabus" as const },
    { label: "RFC 9293 状态机（教学子集，本项目原创实现）", kind: "standard" as const },
  ],
};

interface Step {
  from: "C" | "S";
  flags: string;
  /** 消耗的序号数：数据 = 字节数，SYN/FIN = 1 */
  len?: number;
  c?: TcpConnState;
  s?: TcpConnState;
  /** 固定 ack 值（默认自动取对端 nextSeq） */
  ackNum?: number;
  lost?: boolean;
  timer?: number;
  /** 重传：序号与确认号沿用同方向上一个报文，且不消耗新序号 */
  retransmit?: boolean;
  note: string;
}

const SCRIPTS: Record<TcpScenario, Step[]> = {
  normal: [
    { from: "C", flags: "SYN", len: 1, c: "SYN_SENT", note: "客户端发起连接，携带初始序号 ISN(c)" },
    { from: "S", flags: "SYN,ACK", len: 1, s: "SYN_RCVD", note: "服务端确认 SYN，并给出自己的 ISN(s)" },
    { from: "C", flags: "ACK", c: "ESTABLISHED", s: "ESTABLISHED", note: "三次握手完成，连接建立" },
    { from: "C", flags: "PSH,ACK", len: 0, note: "客户端发送数据（序号按字节递增）" },
    { from: "S", flags: "ACK", note: "服务端确认收到数据" },
    { from: "S", flags: "PSH,ACK", len: 0, note: "服务端回送数据" },
    { from: "C", flags: "ACK", note: "客户端确认服务端数据" },
    { from: "C", flags: "FIN,ACK", len: 1, c: "FIN_WAIT_1", note: "客户端主动关闭（FIN 占 1 个序号）" },
    { from: "S", flags: "ACK", s: "CLOSE_WAIT", c: "FIN_WAIT_2", note: "服务端确认，进入半关闭" },
    { from: "S", flags: "FIN,ACK", len: 1, s: "LAST_ACK", note: "服务端也关闭" },
    { from: "C", flags: "ACK", c: "TIME_WAIT", s: "CLOSED", note: "客户端进入 TIME_WAIT，等待 2MSL" },
    { from: "C", flags: "（2MSL 计时结束）", c: "CLOSED", timer: 2, note: "TIME_WAIT 结束，本地端口真正释放" },
  ],
  "rst-refused": [
    { from: "C", flags: "SYN", len: 1, c: "SYN_SENT", note: "客户端发起连接" },
    { from: "S", flags: "RST,ACK", s: "CLOSED", note: "服务端拒绝（端口未开放），直接复位" },
    { from: "C", flags: "（收到 RST）", c: "CLOSED", note: "客户端放弃连接，回到 CLOSED" },
  ],
  "last-ack-lost": [
    { from: "C", flags: "SYN", len: 1, c: "SYN_SENT", note: "客户端发起连接" },
    { from: "S", flags: "SYN,ACK", len: 1, s: "SYN_RCVD", note: "服务端确认" },
    { from: "C", flags: "ACK", c: "ESTABLISHED", s: "ESTABLISHED", note: "连接建立" },
    { from: "C", flags: "FIN,ACK", len: 1, c: "FIN_WAIT_1", note: "客户端关闭" },
    { from: "S", flags: "ACK", s: "CLOSE_WAIT", c: "FIN_WAIT_2", note: "服务端确认" },
    { from: "S", flags: "FIN,ACK", len: 1, s: "LAST_ACK", note: "服务端发送 FIN" },
    { from: "C", flags: "ACK", c: "TIME_WAIT", lost: true, note: "客户端最后的 ACK —— **丢失**" },
    { from: "S", flags: "FIN,ACK", c: "TIME_WAIT", retransmit: true, note: "服务端超时重传 FIN（序号不变）" },
    { from: "C", flags: "ACK", s: "CLOSED", note: "客户端在 TIME_WAIT 内重发 ACK，服务端关闭" },
  ],
  "simultaneous-close": [
    { from: "C", flags: "SYN", len: 1, c: "SYN_SENT", note: "客户端发起连接" },
    { from: "S", flags: "SYN,ACK", len: 1, s: "SYN_RCVD", note: "服务端确认" },
    { from: "C", flags: "ACK", c: "ESTABLISHED", s: "ESTABLISHED", note: "连接建立" },
    { from: "C", flags: "FIN,ACK", len: 1, c: "FIN_WAIT_1", note: "客户端先发 FIN" },
    { from: "S", flags: "FIN,ACK", len: 1, s: "FIN_WAIT_1", note: "服务端还没来得及确认就也发 FIN（同时关闭）" },
    { from: "C", flags: "ACK", c: "CLOSING", note: "客户端确认对端 FIN，进入 CLOSING" },
    { from: "S", flags: "ACK", s: "CLOSING", note: "服务端确认对端 FIN，也进入 CLOSING" },
    { from: "C", flags: "ACK", c: "TIME_WAIT", note: "客户端最后确认" },
    { from: "S", flags: "ACK", s: "CLOSED", timer: 2, note: "双方关闭，客户端等待 2MSL" },
  ],
};

export const STATE_ORDER: TcpConnState[] = [
  "CLOSED", "SYN_SENT", "SYN_RCVD", "ESTABLISHED",
  "FIN_WAIT_1", "FIN_WAIT_2", "CLOSE_WAIT", "CLOSING", "LAST_ACK", "TIME_WAIT",
];

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const value = input as Partial<TcpInput> | null;
  if (!value || typeof value !== "object") {
    return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  }
  if (!["normal", "rst-refused", "last-ack-lost", "simultaneous-close"].includes(String(value.scenario))) {
    issues.push({ path: "scenario", message: "未知场景", severity: "error" });
  }
  for (const key of ["clientIsn", "serverIsn"] as const) {
    const isn = value[key];
    if (!Number.isInteger(isn) || (isn as number) < 0 || (isn as number) > 0xffffffff) {
      issues.push({ path: key, message: "初始序号必须是 0–4294967295 的整数", severity: "error" });
    }
  }
  for (const key of ["clientDataBytes", "serverDataBytes"] as const) {
    const n = value[key];
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 10000) {
      issues.push({ path: key, message: "数据长度必须是 0–10000 的整数", severity: "error" });
    }
  }
  return issues;
}

export const simulate: Simulator<TcpInput, TcpState, TcpEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as TcpInput;
  const frames: Frame<TcpState, TcpEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const script = SCRIPTS[input.scenario];
  let clientState: TcpConnState = "CLOSED";
  let serverState: TcpConnState = "CLOSED";
  let clientNextSeq = input.clientIsn;
  let serverNextSeq = input.serverIsn;
  let clock = 0;
  const packets: TcpPacket[] = [];

  const snapshot = (): Omit<TcpState, "currentIndex"> => ({
    clientState,
    serverState,
    clientNextSeq,
    serverNextSeq,
    packets: packets.map((p) => ({ ...p })),
    clock,
    scenario: input.scenario,
  });

  const push = (event: TcpEvent, narration: string) => {
    frames.push({
      index: frames.length,
      state: { ...snapshot(), ...(event.type === "PACKET" ? { currentIndex: event.packet.index } : {}) },
      event,
      narration,
    });
  };

  push(
    { type: "INIT" },
    `初始：双方都处于 CLOSED，ISN(c)=${input.clientIsn}，ISN(s)=${input.serverIsn}`,
  );

  for (const step of script) {
    clock += 0.5;
    if (step.timer) clock += step.timer;

    if (step.flags.startsWith("（")) {
      // 纯状态变化（超时/收到 RST），不发报文
      if (step.c) clientState = step.c;
      if (step.s) serverState = step.s;
      push(
        { type: "TIMER", label: step.flags, duration: step.timer ?? 0.5 },
        step.note,
      );
      continue;
    }

    const isClient = step.from === "C";
    const previous = step.retransmit
      ? [...packets].reverse().find((p) => p.from === step.from && p.seq !== undefined)
      : undefined;
    const seq = previous?.seq ?? (isClient ? clientNextSeq : serverNextSeq);
    const ack = previous?.ack ?? step.ackNum ?? (isClient ? serverNextSeq : clientNextSeq);
    const bytes =
      step.flags.includes("SYN") || step.flags.includes("FIN")
        ? 1
        : isClient
          ? step.len && step.len > 0 ? step.len : input.clientDataBytes
          : step.len && step.len > 0 ? step.len : input.serverDataBytes;

    const isData = step.flags.includes("PSH");
    const consumes = step.retransmit
      ? 0
      : step.flags.includes("SYN") || step.flags.includes("FIN") ? 1 : isData ? bytes : 0;

    const hasAck = step.flags.includes("ACK");
    const packet: TcpPacket = {
      index: packets.length,
      from: step.from,
      flags: step.flags,
      seq,
      ...(hasAck ? { ack } : {}),
      ...(isData ? { bytes } : {}),
      ...(step.lost ? { lost: true } : {}),
      at: clock,
      note: step.note,
    };
    packets.push(packet);
    if (isClient) clientNextSeq += consumes;
    else serverNextSeq += consumes;
    if (step.c) clientState = step.c;
    if (step.s) serverState = step.s;

    push(
      { type: "PACKET", packet: { ...packet } },
      `${isClient ? "客户端" : "服务端"} → ${isClient ? "服务端" : "客户端"}：${step.flags}，seq=${seq}${hasAck ? `，ack=${ack}` : ""}${step.lost ? "（丢失）" : ""}。${step.note}`,
    );
  }

  const elapsed = clock;
  push(
    { type: "DONE", packets: packets.length, elapsed },
    `结束：共 ${packets.length} 个报文，用时 ${elapsed} × 0.5 RTT；客户端 ${clientState} / 服务端 ${serverState}`,
  );

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: TcpInput = {
  clientIsn: 1000,
  serverIsn: 5000,
  clientDataBytes: 1000,
  serverDataBytes: 200,
  scenario: "normal",
};