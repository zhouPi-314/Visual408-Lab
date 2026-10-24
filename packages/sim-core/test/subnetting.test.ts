import { describe, expect, it } from "vitest";
import { module as subnet } from "../src/modules/subnetting";

const run = (ip: string, prefix: number) => subnet.simulate({ ip, prefix });
const last = (ip: string, prefix: number) => run(ip, prefix).frames.at(-1)!.state;

describe("net.subnetting：/25 子网", () => {
  const s = last("192.168.10.130", 25);

  it("掩码 255.255.255.128", () => expect(s.mask).toBe("255.255.255.128"));
  it("网络地址 192.168.10.128", () => expect(s.network).toBe("192.168.10.128"));
  it("广播地址 192.168.10.255", () => expect(s.broadcast).toBe("192.168.10.255"));
  it("可用主机 126 个，范围 .129–.254", () => {
    expect(s.hostCount).toBe(126);
    expect(s.firstHost).toBe("192.168.10.129");
    expect(s.lastHost).toBe("192.168.10.254");
  });
});

describe("net.subnetting：常见前缀", () => {
  it("/24 的可用主机是 254", () => {
    const s = last("10.0.0.7", 24);
    expect(s.network).toBe("10.0.0.0");
    expect(s.broadcast).toBe("10.0.0.255");
    expect(s.hostCount).toBe(254);
  });

  it("/30 只有 2 个可用地址（点对点）", () => {
    const s = last("192.168.1.6", 30);
    expect(s.network).toBe("192.168.1.4");
    expect(s.broadcast).toBe("192.168.1.7");
    expect(s.hostCount).toBe(2);
    expect(s.firstHost).toBe("192.168.1.5");
    expect(s.lastHost).toBe("192.168.1.6");
  });

  it("/32 没有可用主机地址", () => {
    expect(last("203.0.113.9", 32).hostCount).toBe(0);
  });

  it("/0 覆盖整个地址空间", () => {
    const s = last("8.8.8.8", 0);
    expect(s.network).toBe("0.0.0.0");
    expect(s.broadcast).toBe("255.255.255.255");
  });
});

describe("net.subnetting：位运算自洽", () => {
  it("网络地址 = IP AND 掩码", () => {
    for (const [ip, prefix] of [["172.16.34.200", 20], ["192.168.5.5", 26], ["10.1.2.3", 12]] as const) {
      const s = last(ip, prefix);
      const and = s.ipBits.map((b, i) => b & s.maskBits[i]!).join("");
      expect(s.networkBits.join("")).toBe(and);
    }
  });

  it("主机位数 = 32 − 前缀，可用主机 = 2^h − 2（h ≥ 2）", () => {
    for (const prefix of [8, 16, 24, 28]) {
      const h = 32 - prefix;
      expect(last("1.2.3.4", prefix).hostCount).toBe(2 ** h - 2);
    }
  });
});

describe("net.subnetting：输入校验", () => {
  it("非法 IP 报错", () => {
    expect(subnet.simulate({ ip: "192.168.1", prefix: 24 }).validate().some((i) => i.path === "ip")).toBe(true);
    expect(subnet.simulate({ ip: "192.168.1.256", prefix: 24 }).validate().some((i) => i.path === "ip")).toBe(true);
  });

  it("前缀越界报错", () => {
    expect(subnet.simulate({ ip: "1.2.3.4", prefix: 33 }).validate().some((i) => i.path === "prefix")).toBe(true);
  });
});
