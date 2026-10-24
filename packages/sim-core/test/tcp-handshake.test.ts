import { describe, expect, it } from "vitest";
import { module as tcp } from "../src/modules/tcp-handshake";
import type { TcpPacket, TcpScenario } from "../src/modules/tcp-handshake/types";

const run = (scenario: TcpScenario = "normal") => tcp.simulate({ ...tcp.defaultInput, scenario });

const packets = (scenario: TcpScenario = "normal"): TcpPacket[] => {
  const sim = run(scenario);
  return sim.frames.at(-1)!.state.packets;
};

describe("net.tcp-handshake：正常场景（docs/modules/first-modules-spec.md §4.5）", () => {
  it("三次握手的 seq/ack 关系", () => {
    const p = packets();
    expect(p[0]).toMatchObject({ from: "C", flags: "SYN", seq: 1000 });
    expect(p[1]).toMatchObject({ from: "S", flags: "SYN,ACK", seq: 5000, ack: 1001 });
    expect(p[2]).toMatchObject({ from: "C", flags: "ACK", seq: 1001, ack: 5001 });
  });

  it("数据阶段序号按字节推进", () => {
    const p = packets();
    expect(p[3]).toMatchObject({ from: "C", flags: "PSH,ACK", seq: 1001, bytes: 1000 });
    expect(p[4]).toMatchObject({ from: "S", flags: "ACK", ack: 2001 });
    expect(p[5]).toMatchObject({ from: "S", flags: "PSH,ACK", seq: 5001, bytes: 200 });
    expect(p[6]).toMatchObject({ from: "C", flags: "ACK", ack: 5201 });
  });

  it("四次挥手：FIN 各占 1 个序号，末次 ACK 后进入 TIME_WAIT", () => {
    const p = packets();
    expect(p[7]).toMatchObject({ from: "C", flags: "FIN,ACK", seq: 2001, ack: 5201 });
    expect(p[8]).toMatchObject({ from: "S", flags: "ACK", ack: 2002 });
    expect(p[9]).toMatchObject({ from: "S", flags: "FIN,ACK", seq: 5201 });
    expect(p[10]).toMatchObject({ from: "C", flags: "ACK", ack: 5202 });
    const done = run().frames.at(-1)!.state;
    expect(done.clientState).toBe("CLOSED");
    expect(done.serverState).toBe("CLOSED");
  });

  it("TIME_WAIT 至少存在一帧", () => {
    const sim = run();
    expect(sim.frames.some((f) => f.state.clientState === "TIME_WAIT")).toBe(true);
  });
});

describe("net.tcp-handshake：异常场景", () => {
  it("RST 拒绝：不进入 ESTABLISHED", () => {
    const sim = run("rst-refused");
    expect(sim.frames.some((f) => f.state.clientState === "ESTABLISHED")).toBe(false);
    expect(sim.frames.at(-1)!.state.clientState).toBe("CLOSED");
    expect(packets("rst-refused")[1]).toMatchObject({ flags: "RST,ACK" });
  });

  it("末次 ACK 丢失：服务端重传 FIN，客户端重发 ACK", () => {
    const p = packets("last-ack-lost");
    expect(p.some((x) => x.lost)).toBe(true);
    const fins = p.filter((x) => x.from === "S" && x.flags === "FIN,ACK");
    expect(fins).toHaveLength(2);
    expect(fins[0]!.seq).toBe(fins[1]!.seq); // 重传序号不变
    expect(run("last-ack-lost").frames.at(-1)!.state.serverState).toBe("CLOSED");
  });

  it("同时关闭：双方都经过 CLOSING", () => {
    const sim = run("simultaneous-close");
    expect(sim.frames.some((f) => f.state.clientState === "CLOSING")).toBe(true);
    expect(sim.frames.some((f) => f.state.serverState === "CLOSING")).toBe(true);
  });
});

describe("net.tcp-handshake：不变量与校验", () => {
  it("同一方向序号单调递增", () => {
    const p = packets().filter((x) => x.seq !== undefined);
    for (let i = 1; i < p.length; i++) {
      const prev = p[i - 1]!;
      const cur = p[i]!;
      if (prev.from === cur.from) expect(cur.seq!).toBeGreaterThanOrEqual(prev.seq!);
    }
  });

  it("报文数 = 脚本长度", () => {
    expect(packets()).toHaveLength(11);
    expect(packets("rst-refused")).toHaveLength(2);
    expect(packets("last-ack-lost")).toHaveLength(9);
  });

  it("非法 ISN 报错", () => {
    const sim = tcp.simulate({ ...tcp.defaultInput, clientIsn: -1 });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path === "clientIsn")).toBe(true);
  });
});
