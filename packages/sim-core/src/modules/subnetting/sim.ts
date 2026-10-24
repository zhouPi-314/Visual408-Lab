import type { Frame, Issue, Simulator } from "../../protocol";
import type { SubnetEvent, SubnetInput, SubnetState } from "./types";

const META = {
  id: "net.subnetting",
  subject: "net" as const,
  title: "IPv4 子网划分",
  syllabusVersion: "2026",
  references: [
    { label: "408 考试大纲·计算机网络·网络层", kind: "syllabus" as const },
    { label: "子网划分的逐位推演（本项目原创实现）", kind: "original" as const },
  ],
};

export function parseIp(ip: string): number[] | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums as number[];
}

export function toBits(octets: number[]): number[] {
  return octets.flatMap((o) => o.toString(2).padStart(8, "0").split("").map(Number));
}

export function bitsToOctets(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 32; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0) >>> 0);
  }
  return out;
}

export const bitsToIp = (bits: number[]) => bitsToOctets(bits).join(".");

export function validate(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const v = input as Partial<SubnetInput> | null;
  if (!v || typeof v !== "object") return [{ path: "", message: "输入必须是一个对象", severity: "error" }];
  if (typeof v.ip !== "string" || parseIp(v.ip) === null) {
    issues.push({ path: "ip", message: "IP 必须是合法的点分十进制（4 段，每段 0–255）", severity: "error" });
  }
  if (!Number.isInteger(v.prefix) || (v.prefix as number) < 0 || (v.prefix as number) > 32) {
    issues.push({ path: "prefix", message: "前缀长度必须是 0–32 的整数", severity: "error" });
  }
  return issues;
}

export const simulate: Simulator<SubnetInput, SubnetState, SubnetEvent> = (rawInput) => {
  const issues = validate(rawInput);
  const input = rawInput as SubnetInput;
  const frames: Frame<SubnetState, SubnetEvent>[] = [];
  if (issues.some((i) => i.severity === "error")) {
    return { input, meta: META, frames, validate: () => issues };
  }

  const octets = parseIp(input.ip)!;
  const ipBits = toBits(octets);
  const maskBits = ipBits.map((_, i) => (i < input.prefix ? 1 : 0));
  const networkBits = ipBits.map((b, i) => b & maskBits[i]!);
  const broadcastBits = ipBits.map((b, i) => (maskBits[i] === 1 ? b : 1));

  const network = bitsToIp(networkBits);
  const broadcast = bitsToIp(broadcastBits);
  const hostBits = 32 - input.prefix;
  const hostCount = hostBits >= 2 ? 2 ** hostBits - 2 : 0;
  const firstHost = hostCount > 0 ? bitsToIp([...networkBits.slice(0, 31), 1]) : network;
  const lastHost = hostCount > 0
    ? bitsToIp(broadcastBits.map((b, i) => (i === 31 ? 0 : b)))
    : network;

  const base = {
    ip: input.ip,
    prefix: input.prefix,
    ipBits,
    maskBits,
    networkBits,
    broadcastBits,
    mask: bitsToIp(maskBits),
    network,
    broadcast,
    firstHost,
    lastHost,
    hostCount,
  };

  const push = (event: SubnetEvent, narration: string, stage: number) => {
    frames.push({ index: frames.length, state: { ...base, stage }, event, narration });
  };

  push({ type: "BITS", ip: input.ip }, `把 ${input.ip} 展开成 32 位，前 ${input.prefix} 位是网络号、后 ${hostBits} 位是主机号`, 1);
  push({ type: "MASK", prefix: input.prefix, mask: base.mask }, `子网掩码：前 ${input.prefix} 位为 1 → ${base.mask}`, 2);
  push(
    { type: "NETWORK", network },
    `网络地址 = IP AND 掩码 = ${network}（主机号全 0，代表这个子网本身）`,
    3,
  );
  push(
    { type: "BROADCAST", broadcast },
    `广播地址 = 网络号不变、主机号全 1 = ${broadcast}`,
    4,
  );
  push(
    { type: "HOSTS", firstHost, lastHost, hostCount },
    hostBits >= 2
      ? `可用主机 ${hostCount} 个：${firstHost} – ${lastHost}（去掉网络地址与广播地址）`
      : `主机号只剩 ${hostBits} 位，${hostBits === 2 ? "只有 2 个地址（点对点链路可用）" : "没有可用主机地址"}`,
    5,
  );
  push({ type: "DONE" }, `小结：${input.ip}/${input.prefix} 属于子网 ${network}，广播 ${broadcast}，可用 ${hostCount} 台主机`, 5);

  return { input, meta: META, frames, validate: () => issues };
};

export const meta = META;

export const defaultInput: SubnetInput = { ip: "192.168.10.130", prefix: 25 };
