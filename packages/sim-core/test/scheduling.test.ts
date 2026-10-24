import { describe, expect, it } from "vitest";
import { module as sched } from "../src/modules/scheduling";
import type { SchedAlgorithm } from "../src/modules/scheduling/types";

const procs = [
  { pid: "P1", arrive: 0, burst: 3 },
  { pid: "P2", arrive: 1, burst: 2 },
  { pid: "P3", arrive: 2, burst: 1 },
];

const run = (algorithm: SchedAlgorithm, quantum = 1) =>
  sched.simulate({ algorithm, quantum, processes: procs });

const segments = (algorithm: SchedAlgorithm, quantum = 1) =>
  run(algorithm, quantum)
    .frames.at(-1)!
    .state.segments.map((s) => `${s.pid}:${s.start}-${s.end}`);

const results = (algorithm: SchedAlgorithm, quantum = 1) =>
  run(algorithm, quantum).frames.at(-1)!.state.results;

describe("os.scheduling：FCFS", () => {
  it("按到达顺序执行，甘特图连续", () => {
    expect(segments("fcfs")).toEqual(["P1:0-3", "P2:3-5", "P3:5-6"]);
  });

  it("等待时间与周转时间", () => {
    const r = results("fcfs");
    expect(r.map((x) => [x.pid, x.wait, x.turnaround])).toEqual([
      ["P1", 0, 3],
      ["P2", 2, 4],
      ["P3", 3, 4],
    ]);
  });
});

describe("os.scheduling：SJF（非抢占）", () => {
  it("t=3 时在 P2/P3 中挑更短的 P3", () => {
    expect(segments("sjf")).toEqual(["P1:0-3", "P3:3-4", "P2:4-6"]);
  });

  it("平均等待时间优于 FCFS", () => {
    const sjfAvg = (run("sjf").frames.at(-1)!.event as { avgWait: number }).avgWait;
    const fcfsAvg = (run("fcfs").frames.at(-1)!.event as { avgWait: number }).avgWait;
    expect(sjfAvg).toBeLessThan(fcfsAvg);
    expect(sjfAvg).toBeCloseTo(4 / 3, 5);
  });
});

describe("os.scheduling：RR 时间片轮转", () => {
  it("q=1 时按就绪队列轮转（含同刻入队次序）", () => {
    // t=1：P2 到达先入队，被剥夺的 P1 排到队尾 → [P2, P1]
    // t=2：P3 到达 + P1 仍在队首（t=1 已入队）→ [P1, P3, P2]
    // 所以 t=2~3 跑的是 P1，P3 到 t=3 才上场——这就是"轮转"而非"每次换人"
    expect(segments("rr")).toEqual(["P1:0-1", "P2:1-2", "P1:2-3", "P3:3-4", "P2:4-5", "P1:5-6"]);
  });

  it("完成顺序是 P3 → P2 → P1", () => {
    expect(results("rr").map((r) => r.pid)).toEqual(["P3", "P2", "P1"]);
  });

  it("q 越大，RR 越接近 FCFS", () => {
    const big = segments("rr", 10);
    expect(big).toEqual(["P1:0-3", "P2:3-5", "P3:5-6"]);
  });
});

describe("os.scheduling：不变量与校验", () => {
  it("甘特图总长度等于各进程运行时间之和（无空闲时）", () => {
    for (const alg of ["fcfs", "sjf", "rr"] as SchedAlgorithm[]) {
      const sim = run(alg);
      const total = sim.frames.at(-1)!.state.segments.reduce((a, s) => a + (s.end - s.start), 0);
      expect(total).toBe(6);
    }
  });

  it("每个进程都只有一个结果，且周转 = 完成 − 到达", () => {
    for (const alg of ["fcfs", "sjf", "rr"] as SchedAlgorithm[]) {
      const r = results(alg);
      expect(r).toHaveLength(3);
      for (const x of r) expect(x.turnaround).toBe(x.end - x.arrive);
      expect(new Set(r.map((x) => x.pid)).size).toBe(3);
    }
  });

  it("到达时间较大时会出现 CPU 空闲区间", () => {
    const sim = sched.simulate({
      algorithm: "fcfs",
      quantum: 1,
      processes: [
        { pid: "P1", arrive: 0, burst: 1 },
        { pid: "P2", arrive: 5, burst: 1 },
      ],
    });
    const segs = sim.frames.at(-1)!.state.segments;
    expect(segs.some((s) => s.pid === null)).toBe(true);
  });

  it("非法时间片报错", () => {
    const sim = sched.simulate({ algorithm: "rr", quantum: 0, processes: procs });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path === "quantum")).toBe(true);
  });
});
