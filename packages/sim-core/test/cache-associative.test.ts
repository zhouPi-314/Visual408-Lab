import { describe, expect, it } from "vitest";
import { module as assoc } from "../src/modules/cache-associative";

const run = (ways: number, accesses = assoc.defaultInput.accesses) =>
  assoc.simulate({ ...assoc.defaultInput, ways, accesses });

const done = (ways: number, accesses?: string[]) => run(ways, accesses).frames.at(-1)!.event;

describe("co.cache-associative：地址划分", () => {
  it("8 行 2 路 → 4 组；0x043 落在第 0 组、tag=1", () => {
    const sim = run(2);
    const split = sim.frames[0]!.event;
    expect(split).toMatchObject({ type: "SPLIT", index: 0, tag: 0, sets: 4 });
    const second = sim.frames.filter((f) => f.event.type === "SPLIT")[1]!.event;
    expect(second).toMatchObject({ index: 0, tag: 1 });
  });

  it("组数 = 行数 / 路数", () => {
    expect(run(1).frames[0]!.state.sets).toBe(8);
    expect(run(2).frames[0]!.state.sets).toBe(4);
    expect(run(4).frames[0]!.state.sets).toBe(2);
  });
});

describe("co.cache-associative：2 路 vs 直接映射（同一地址串）", () => {
  const ref = ["0x003", "0x043", "0x083", "0x003", "0x083"];

  it("2 路：命中 1、缺失 4", () => {
    expect(done(2, ref)).toMatchObject({ type: "DONE", hits: 1, misses: 4 });
  });

  it("直接映射（1 路）：全部缺失 5 次——这正是相联度带来的收益", () => {
    expect(done(1, ref)).toMatchObject({ type: "DONE", hits: 0, misses: 5 });
  });

  it("2 路的淘汰顺序是 tag 0 → tag 1（LRU）", () => {
    const evictions = run(2, ref)
      .frames.filter((f) => f.event.type === "EVICT")
      .map((f) => (f.event as { tag: number }).tag);
    expect(evictions).toEqual([0, 1]);
  });
});

describe("co.cache-associative：不变量与校验", () => {
  it("命中帧不会产生淘汰", () => {
    const sim = run(2);
    const hitIdx = sim.frames.findIndex((f) => f.event.type === "HIT");
    expect(hitIdx).toBeGreaterThan(-1);
    expect(sim.frames[hitIdx + 1]!.event.type).not.toBe("EVICT");
  });

  it("全相联（ways = lines）时只有一组", () => {
    expect(run(8).frames[0]!.state.sets).toBe(1);
  });

  it("路数超过行数报错", () => {
    const sim = assoc.simulate({ ...assoc.defaultInput, lines: 2, ways: 4 });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path === "ways")).toBe(true);
  });

  it("非法路数报错", () => {
    const sim = assoc.simulate({ ...assoc.defaultInput, ways: 3 });
    expect(sim.validate().some((i) => i.path === "ways")).toBe(true);
  });
});
