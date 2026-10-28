import { describe, expect, it } from "vitest";
import { batch1, batch2, batch3, batch4, batch5, batch6, batch7 } from "../src/index";
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
describe("batch4/5 新增实验", () => {
  const lastMetrics = (sim: any) => {
    const last = sim.frames[sim.frames.length - 1]!;
    const m: Record<string, any> = {};
    for (const x of (last.state as any).metrics ?? []) m[x.label] = x.value;
    return m;
  };

  it("ds.dijkstra：从 v0 出发的距离为 0,8,9,14,5", () => {
    const sim = batch4.dijkstra.simulate({ start: "0" });
    const last = sim.frames[sim.frames.length - 1]!.state as any;
    const bars = last.views.find((v: any) => v.kind === "bars");
    expect(bars.items.map((i: any) => i.value)).toEqual([0, 8, 9, 14, 5]);
  });

  it("ds.topological：DAG 输出 5 个顶点", () => {
    expect(lastMetrics(batch4.topological.simulate({ note: "" }))["序列长度"]).toBe(5);
  });

  it("ds.union-find：三次合并后只剩 1 个连通分量", () => {
    expect(lastMetrics(batch4.unionFind.simulate({ pairs: "0-1, 2-3, 1-3" }))["连通分量"]).toBe(1);
  });

  it("ds.kmp-next：ababaca 的 next 为 0,0,1,2,3,0,1", () => {
    expect(lastMetrics(batch4.kmp.simulate({ pattern: "ababaca" }))["next"]).toBe("0,0,1,2,3,0,1");
  });

  it("co.cache-write：写回 100 次写入只产生 8 次主存写", () => {
    const sim = batch4.cacheWrite.simulate({ writes: "100" });
    const wb = sim.frames.find((f: any) => f.event.type === "WB")!;
    expect((wb.state as any).metrics[0].value).toBe(8);
  });

  it("co.instruction-cycle：间接寻址总周期 12", () => {
    expect(lastMetrics(batch4.instructionCycle.simulate({ mode: "indirect" }))["总周期"]).toBe(12);
  });

  it("co.bus-arbitration：8 设备时链式 8、计数器 3、独立 1", () => {
    const sim = batch4.busArbitration.simulate({ devices: "8" });
    const val = (type: string) => (sim.frames.find((f: any) => f.event.type === type)!.state as any).metrics[0].value;
    expect(val("CHAIN")).toBe(8);
    expect(val("COUNTER")).toBe(3);
    expect(val("INDEP")).toBe(1);
  });

  it("co.raid：RAID5 四盘可用 3 块盘", () => {
    expect(lastMetrics(batch4.raid.simulate({ level: "5", disks: "4" }))["可用容量"]).toBe(3);
  });

  it("os.memory-partition：最佳适应选中 #2（200）", () => {
    const sim = batch5.partition.simulate({ size: "150", alg: "best" });
    const choose = sim.frames.find((f: any) => f.event.type === "CHOOSE")!;
    expect((choose.state as any).metrics[0].value).toBe("#2");
  });

  it("os.segment：段1 偏移 150 → 2150", () => {
    expect(lastMetrics(batch5.segment.simulate({ seg: "1", offset: "150" }))["物理地址"]).toBe(2150);
  });

  it("os.file-allocate：索引分配寻址 2 次", () => {
    expect(lastMetrics(batch5.fileAlloc.simulate({ blocks: "5" }))["寻址次数"]).toBe(2);
  });

  it("os.interrupt：I/O 中断走完五个阶段", () => {
    const sim = batch5.interrupt.simulate({ kind: "io" });
    expect(sim.frames).toHaveLength(5);
    expect(lastMetrics(sim)["类型"]).toBe("I/O 完成");
  });

  it("net.csma-cd：k=2 时退避窗口 4", () => {
    expect(lastMetrics(batch5.csma.simulate({ stations: "8", k: "2" }))["退避窗口"]).toBe(4);
  });

  it("net.nat：两台主机产生 2 条映射", () => {
    expect(lastMetrics(batch5.nat.simulate({ hosts: "2" }))["映射条目"]).toBe(2);
  });

  it("net.dns-resolve：迭代查询主机发起 3 次", () => {
    expect(lastMetrics(batch5.dns.simulate({ mode: "iterative" }))["主机发起查询"]).toBe(3);
  });
});
describe("batch6/7 第三批实验", () => {
  const lastM = (sim: any) => {
    const last = sim.frames[sim.frames.length - 1]!;
    const m: Record<string, any> = {};
    for (const x of (last.state as any).metrics ?? []) m[x.label] = x.value;
    return m;
  };

  it("ds.bst-search：找 40 比较 3 次并命中", () => {
    const m = lastM(batch6.bstSearch.simulate({ target: "40" }));
    expect(m["比较次数"]).toBe(3);
    expect(m["结果"]).toBe("命中");
  });

  it("ds.floyd：v0→v3 最短路 9", () => {
    expect(lastM(batch6.floyd.simulate({ note: "" }))["d[0][3]"]).toBe(9);
  });

  it("ds.huffman：5,9,12,13,16,45 的 WPL 为 224", () => {
    expect(lastM(batch6.huffman.simulate({ weights: "5, 9, 12, 13, 16, 45" }))["WPL"]).toBe(224);
  });

  it("ds.cyclic-queue：示例操作后 front=1、rear=4", () => {
    const m = lastM(batch6.cyclicQueue.simulate({ ops: "入3, 入7, 出, 入1, 入4" }));
    expect(m["front"]).toBe(1);
    expect(m["rear"]).toBe(4);
  });

  it("co.pipeline-timing：5 条指令需要 9 个周期", () => {
    expect(lastM(batch6.pipelineTiming.simulate({ n: "5" }))["总周期"]).toBe(9);
  });

  it("co.cache-miss-types：0,8,0,8 产生 2 强制 + 2 冲突", () => {
    const sim = batch6.missTypes.simulate({ seq: "0, 8, 0, 8" });
    const m = (sim.frames[sim.frames.length - 1]!.state as any).metrics;
    const get = (k: string) => m.find((x: any) => x.label === k)?.value;
    expect(get("强制")).toBe(2);
    expect(get("冲突")).toBe(2);
  });

  it("co.data-representation：-5 的补码是 11111011", () => {
    expect(lastM(batch6.dataRepr.simulate({ value: "-5" }))["补码"]).toBe("11111011");
  });

  it("co.memory-interleave：4 体 8 字加速比 1.6", () => {
    expect(lastM(batch6.interleave.simulate({ banks: "4", words: "8" }))["加速比"]).toBe("1.60×");
  });

  it("os.page-fault：脏页需要 2 次磁盘 I/O", () => {
    expect(lastM(batch7.pageFault.simulate({ dirty: "dirty" }))["磁盘 I/O"]).toBe(2);
  });

  it("os.thrashing：4 个页框对 8 页工作集判为抖动", () => {
    expect(lastM(batch7.thrashing.simulate({ frames: "4" }))["状态"]).toBe("抖动");
  });

  it("os.disk-layout：C=100,H=3,S=17 → LBA 101005", () => {
    expect(lastM(batch7.diskLayout.simulate({ c: "100", h: "3", s: "17" }))["LBA"]).toBe(101005);
  });

  it("os.peterson：不会同时进入临界区", () => {
    expect(lastM(batch7.peterson.simulate({ order: "p0" }))["互斥"]).toBe("成立");
  });

  it("net.cidr-route：10.1.2.5 命中 /24 走 R3", () => {
    expect(lastM(batch7.cidrRoute.simulate({ dst: "10.1.2.5" }))["下一跳"]).toBe("R3");
  });

  it("net.tcp-flow-control：窗口收缩后恢复为 4", () => {
    expect(lastM(batch7.tcpFlow.simulate({ rwnd: "4" }))["rwnd"]).toBe(4);
  });

  it("net.dhcp：DORA 共 4 个报文", () => {
    expect(lastM(batch7.dhcp.simulate({ relay: "no" }))["报文数"]).toBe(4);
  });
});