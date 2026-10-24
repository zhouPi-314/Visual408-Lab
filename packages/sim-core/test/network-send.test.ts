import { describe, expect, it } from "vitest";
import { module as send } from "../src/modules/network-send";

const run = (patch: Partial<typeof send.defaultInput> = {}) =>
  send.simulate({ ...send.defaultInput, ...patch });

const last = (patch: Partial<typeof send.defaultInput> = {}) => run(patch).frames.at(-1)!.state;

describe("cross.network-send-chain：TCP 分段", () => {
  it("3000 字节按 MSS=1460 分成 3 段（1460/1460/80）", () => {
    const s = last();
    expect(s.segments.map((x) => x.bytes)).toEqual([1460, 1460, 80]);
  });

  it("序号连续推进", () => {
    const s = last();
    expect(s.segments[0]).toMatchObject({ seqStart: 1, seqEnd: 1460 });
    expect(s.segments[1]).toMatchObject({ seqStart: 1461, seqEnd: 2920 });
    expect(s.segments[2]).toMatchObject({ seqStart: 2921, seqEnd: 3000 });
  });

  it("MSS 大于数据量时只分一段", () => {
    expect(last({ dataBytes: 500 }).segments).toHaveLength(1);
  });
});

describe("cross.network-send-chain：IP 封装与 MTU", () => {
  it("IP 包总长 = 载荷 + 20 + 20", () => {
    const s = last();
    expect(s.packets[0]!.total).toBe(1460 + 40);
  });

  it("MTU=1500 时不需要分片", () => {
    expect(last().needsFragmentation).toBe(false);
    expect(last().fragments).toHaveLength(0);
  });

  it("MTU 小于 IP 包时按 8 字节对齐分片", () => {
    const s = last({ mtu: 1000 });
    expect(s.needsFragmentation).toBe(true);
    // 每片最大载荷 = floor((1000-20)/8)*8 = 976
    expect(s.fragments[0]).toMatchObject({ offset: 0, bytes: 976, more: true });
    expect(s.fragments[1]).toMatchObject({ offset: 976, bytes: 484, more: false });
  });
});

describe("cross.network-send-chain：路由与 ARP（复用子网判断）", () => {
  it("同子网：下一跳就是目的主机", () => {
    const s = last({ dstIp: "192.168.10.50" });
    expect(s.sameSubnet).toBe(true);
    expect(s.nextHop).toBe("192.168.10.50");
    expect(s.arpTarget).toBe("192.168.10.50");
  });

  it("跨子网：下一跳是网关，ARP 只问网关", () => {
    const s = last();
    expect(s.sameSubnet).toBe(false);
    expect(s.srcNetwork).toBe("192.168.10.0");
    expect(s.dstNetwork).toBe("192.168.20.0");
    expect(s.nextHop).toBe("192.168.10.1");
    expect(s.arpTarget).toBe("192.168.10.1");
  });

  it("前缀改变会改变同子网判断", () => {
    expect(last({ prefix: 16 }).sameSubnet).toBe(true); // 192.168.0.0/16 包含两者
  });
});

describe("cross.network-send-chain：开销与不变量", () => {
  it("头部开销 = 链路总字节 − 有效载荷", () => {
    const s = last();
    const expectOverhead = 3 * (20 + 20) + 3 * (14 + 4);
    expect(s.overhead).toBe(expectOverhead);
  });

  it("分段字节之和等于数据量", () => {
    for (const dataBytes of [1, 100, 1460, 1461, 5000]) {
      const s = last({ dataBytes });
      expect(s.segments.reduce((a, x) => a + x.bytes, 0)).toBe(dataBytes);
    }
  });

  it("每个 IP 包都有对应的 TCP 段", () => {
    const s = last();
    expect(s.packets).toHaveLength(s.segments.length);
  });
});

describe("cross.network-send-chain：输入校验", () => {
  it("非法 IP 报错", () => {
    expect(send.simulate({ ...send.defaultInput, srcIp: "999.1.1.1" }).validate().some((i) => i.path === "srcIp")).toBe(true);
  });

  it("MTU 过小报错", () => {
    expect(send.simulate({ ...send.defaultInput, mtu: 20 }).validate().some((i) => i.path === "mtu")).toBe(true);
  });
});
