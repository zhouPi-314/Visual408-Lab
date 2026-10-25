import { describe, expect, it } from "vitest";
import { batch1, batch2, batch3 } from "../src/index";
import type { GenericState } from "../src/view";

const run = (mod: any, input: any) => mod.simulate(input);

const metricsOf = (sim: any) => {
  const last = sim.frames[sim.frames.length - 1]!;
  const m: Record<string, string | number> = {};
  for (const item of (last.state as GenericState).metrics ?? []) m[item.label] = item.value;
  return m;
};

describe("ds.stack-queue", () => {
  it("弹出栈顶 2、取出队首 3", () => {
    const sim = run(batch1.stackQueue, { ops: "push 1, push 2, pop, enqueue 3, dequeue" });
    expect(sim.frames.map((f: any) => f.event.type)).toContain("POP");
    expect(sim.frames.map((f: any) => f.event.type)).toContain("DEQUEUE");
    const m = metricsOf(sim);
    expect(m["栈长"]).toBe(1);
    expect(m["队长"]).toBe(0);
  });
});

describe("ds.heap", () => {
  it("插入 10,20,15,30,25 后堆顶为 30", () => {
    const sim = run(batch1.heap, { values: "10, 20, 15, 30, 25" });
    expect(metricsOf(sim)["堆顶"]).toBe(30);
  });
});

describe("ds.hash-table", () => {
  it("同余键线性探测依次落位", () => {
    const sim = run(batch1.hashTable, { keys: "12, 19, 26, 33", size: "7" });
    const last = sim.frames[sim.frames.length - 1]!.state as GenericState;
    const chips = last.views.find((v) => v.kind === "chips") as any;
    expect(chips.items.map((i: any) => i.text)).toEqual(["26", "33", "空", "空", "空", "12", "19"]);
  });
});

describe("ds.kruskal", () => {
  it("选出 3 条边、总权 6", () => {
    const sim = run(batch1.kruskal, { edges: "0-1:4, 0-2:3, 1-2:1, 1-3:2, 2-3:5" });
    const m = metricsOf(sim);
    expect(m["总权值"]).toBe(6);
    expect(sim.frames.filter((f: any) => f.event.type === "ACCEPT")).toHaveLength(3);
  });
});

describe("co.instruction-format", () => {
  it("0x8C220004 → opcode 35, rs 1, rt 2, imm 4", () => {
    const m = metricsOf(run(batch2.instructionFormat, { word: "0x8C220004" }));
    expect(m["opcode"]).toBe(35);
    expect(m["rs"]).toBe(1);
    expect(m["rt"]).toBe(2);
    expect(m["imm"]).toBe(4);
  });
});

describe("co.ieee754", () => {
  it("-12.75 → 符号 1、阶码 130", () => {
    const m = metricsOf(run(batch2.ieee754, { value: "-12.75" }));
    expect(m["符号"]).toBe(1);
    expect(m["阶码"]).toBe(130);
  });
});

describe("co.amat", () => {
  it("95% 命中、1 周期、缺失 50 → AMAT 3.50", () => {
    const m = metricsOf(run(batch2.amat, { hitRate: "95", hitTime: "1", missPenalty: "50" }));
    expect(Number(m["AMAT"])).toBeCloseTo(3.5, 2);
  });
});

describe("co.io-modes", () => {
  it("4KB 时 DMA 占用远小于查询", () => {
    const m = metricsOf(run(batch2.ioModes, { kb: "4" }));
    expect(m["CPU 占用"]).toBe(4);
  });
});

describe("os.banker", () => {
  it("可用 (3,3,2) 时安全序列为 P1 P3 P4 P0 P2", () => {
    const sim = run(batch3.banker, { available: "3,3,2" });
    const last = sim.frames[sim.frames.length - 1]!.state as GenericState;
    const chips = last.views.find((v) => v.kind === "chips") as any;
    expect(chips.items.map((i: any) => i.text)).toEqual(["P1", "P3", "P4", "P0", "P2"]);
  });
});

describe("os.semaphore", () => {
  it("一轮生产消费后信号量回到初值", () => {
    const m = metricsOf(run(batch3.semaphore, {
      bufferSize: "3",
      ops: "P(empty), P(mutex), 放入1, V(mutex), V(full), P(full), P(mutex), 取出1, V(mutex), V(empty)",
    }));
    expect(m["缓冲"]).toBe(0);
    expect(m["阻塞次数"]).toBe(0);
  });
});

describe("os.disk-scheduling", () => {
  it("SSTF 总寻道 236，FCFS 640", () => {
    expect(metricsOf(run(batch3.diskScheduling, { alg: "sstf", head: "53" }))["总寻道"]).toBe(236);
    expect(metricsOf(run(batch3.diskScheduling, { alg: "fcfs", head: "53" }))["总寻道"]).toBe(640);
  });
});

describe("os.inode", () => {
  it("4KB 块、1MB 文件需要 256 块", () => {
    const m = metricsOf(run(batch3.inode, { blockSize: "4096", fileSize: "1024" }));
    expect(m["块数"]).toBe(256);
  });
});

describe("net.crc", () => {
  it("1101011011 / 10011 的余数为 1110", () => {
    const m = metricsOf(run(batch3.crc, { data: "1101011011", poly: "10011" }));
    expect(m["CRC"]).toBe("1110");
  });
});

describe("net.gbn-window", () => {
  it("窗口 3 超时后重传 3 帧", () => {
    const m = metricsOf(run(batch3.gbn, { window: "3" }));
    expect(m["重传"]).toBe(3);
  });
});

describe("net.arp", () => {
  it("跨网段时下一跳是网关", () => {
    const m = metricsOf(run(batch3.arp, { dst: "192.168.20.50" }));
    expect(m["下一跳"]).toBe("192.168.10.1");
  });
});