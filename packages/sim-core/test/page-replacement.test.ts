import { describe, expect, it } from "vitest";
import { module as pageModule } from "../src/modules/page-replacement";
import { REF_PRESET, BELADY_PRESET, parseRef } from "../src/modules/page-replacement/sim";

const run = (alg: "FIFO" | "LRU" | "OPT", frames: number, ref = REF_PRESET) =>
  pageModule.simulate({ alg, frames, ref });

const faults = (alg: "FIFO" | "LRU" | "OPT", frames: number, ref = REF_PRESET) => {
  const sim = run(alg, frames, ref);
  const done = sim.frames.at(-1)!.event;
  return (done as { faults: number }).faults;
};

describe("os.page-replacement：黄金向量（docs/modules/first-modules-spec.md §3.5）", () => {
  it("引用串共 20 次", () => {
    expect(parseRef(REF_PRESET)).toHaveLength(20);
  });

  it("3 帧：FIFO=15 / LRU=12 / OPT=9", () => {
    expect(faults("FIFO", 3)).toBe(15);
    expect(faults("LRU", 3)).toBe(12);
    expect(faults("OPT", 3)).toBe(9);
  });

  it("缺页率与命中数自洽", () => {
    const sim = run("LRU", 3);
    const done = sim.frames.at(-1)!.event as { hits: number; faults: number; rate: number };
    expect(done.hits + done.faults).toBe(20);
    expect(done.rate).toBeCloseTo(12 / 20, 5);
  });
});

describe("Belady 异常：帧数增加反而更差（只发生在 FIFO）", () => {
  it("FIFO 3 帧 9 次，4 帧 10 次", () => {
    expect(faults("FIFO", 3, BELADY_PRESET)).toBe(9);
    expect(faults("FIFO", 4, BELADY_PRESET)).toBe(10);
  });

  it("LRU 不会出现该异常：3 帧 10 次，4 帧 8 次", () => {
    expect(faults("LRU", 3, BELADY_PRESET)).toBe(10);
    expect(faults("LRU", 4, BELADY_PRESET)).toBe(8);
  });
});

describe("os.page-replacement：状态机与不变量", () => {
  it("首次访问必为强制缺页 + 装入，无淘汰帧", () => {
    const types = run("LRU", 3).frames.map((f) => f.event.type);
    expect(types.slice(0, 3)).toEqual(["ACCESS", "FAULT", "LOAD"]);
  });

  it("每次访问恰好产生一个 ACCESS 事件", () => {
    const sim = run("FIFO", 4);
    expect(sim.frames.filter((f) => f.event.type === "ACCESS")).toHaveLength(20);
    expect(sim.frames[0]!.state.slots).toHaveLength(4);
  });

  it("命中帧不会淘汰任何页", () => {
    const sim = run("LRU", 3);
    const idx = sim.frames.findIndex((f) => f.event.type === "HIT");
    expect(idx).toBeGreaterThan(0);
    expect(sim.frames.slice(idx, idx + 2).some((f) => f.event.type === "EVICT")).toBe(false);
  });

  it("任意时刻占用块数不超过容量", () => {
    for (const f of run("OPT", 2).frames) {
      expect(f.state.slots.filter((s) => s !== null).length).toBeLessThanOrEqual(2);
    }
  });
});

describe("os.page-replacement：输入校验", () => {
  it("页号越界报错", () => {
    const sim = pageModule.simulate({ alg: "LRU", frames: 3, ref: "1,2,12" });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path.startsWith("ref["))).toBe(true);
  });

  it("块数越界报错", () => {
    const sim = pageModule.simulate({ alg: "LRU", frames: 9, ref: "1,2" });
    expect(sim.validate().some((i) => i.path === "frames")).toBe(true);
  });

  it("空引用串报错", () => {
    const sim = pageModule.simulate({ alg: "FIFO", frames: 3, ref: "  " });
    expect(sim.validate().some((i) => i.path === "ref")).toBe(true);
  });
});
