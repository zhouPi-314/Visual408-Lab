import { describe, expect, it } from "vitest";
import { module as sorting } from "../src/modules/sorting";
import type { SortAlgorithm } from "../src/modules/sorting/types";

const run = (algorithm: SortAlgorithm, data = "5, 2, 9, 1") =>
  sorting.simulate({ algorithm, data });

const finalArray = (algorithm: SortAlgorithm, data?: string) =>
  run(algorithm, data).frames.at(-1)!.state.array;

describe("ds.sorting：排序结果正确", () => {
  it("三种算法都能把同一组数据排好", () => {
    for (const alg of ["insertion", "bubble", "quick"] as SortAlgorithm[]) {
      expect(finalArray(alg)).toEqual([1, 2, 5, 9]);
    }
  });

  it("含重复元素也正确", () => {
    for (const alg of ["insertion", "bubble", "quick"] as SortAlgorithm[]) {
      expect(finalArray(alg, "49, 38, 65, 97, 76, 13, 27, 49")).toEqual([13, 27, 38, 49, 49, 65, 76, 97]);
    }
  });

  it("任何时刻元素多重集不变（插入排序的空位除外）", () => {
    for (const alg of ["insertion", "bubble", "quick"] as SortAlgorithm[]) {
      const sim = run(alg, "7, 3, 5, 1, 9");
      const original = sim.frames[0]!.state.array.filter((v) => v !== null).sort((a, b) => a! - b!).join(",");
      for (const f of sim.frames) {
        // 插入排序把待插入值暂时「拿在手里」，所以要把 keyValue 一起算进多重集
        const present = [
          ...f.state.array.filter((v) => v !== null),
          ...(f.state.keyValue !== undefined ? [f.state.keyValue] : []),
        ].sort((a, b) => a - b).join(",");
        expect(present).toBe(original);
        expect(f.state.array.filter((v) => v === null).length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("ds.sorting：过程可解释", () => {
  it("冒泡 [5,2,9,1] 共交换 4 次、比较 6 次", () => {
    const stats = (run("bubble").frames.at(-1)!.event as { stats: { compares: number; moves: number } }).stats;
    expect(stats.moves / 2).toBe(4);
    expect(stats.compares).toBe(6);
  });

  it("冒泡第 1 趟把最大值送到末尾", () => {
    const sim = run("bubble");
    const firstPassEnd = sim.frames.findIndex((f) => f.event.type === "PASS");
    expect(sim.frames[firstPassEnd]!.state.array.at(-1)).toBe(9);
  });

  it("冒泡在已有序时提前结束（第 1 趟无交换即停）", () => {
    const sim = run("bubble", "1, 2, 3, 4");
    const passes = sim.frames.filter((f) => f.event.type === "PASS");
    expect(passes).toHaveLength(1);
    expect(sim.frames.some((f) => f.event.type === "SWAP")).toBe(false);
  });

  it("插入排序每趟结束时前缀都有序", () => {
    const sim = run("insertion", "5, 2, 9, 1, 7");
    const passes = sim.frames.filter((f) => f.event.type === "PASS");
    expect(passes.length).toBeGreaterThan(0);
    for (const f of passes) {
      const i = (f.event as { pass: number }).pass;
      const prefix = f.state.array.slice(0, i + 1) as number[];
      expect([...prefix].sort((a, b) => a - b)).toEqual(prefix);
    }
  });

  it("快排会把枢轴放到最终位置", () => {
    const sim = run("quick");
    const pivots = sim.frames.filter((f) => f.event.type === "PASS");
    expect(pivots.length).toBeGreaterThan(0);
    for (const p of pivots) {
      const settledIdx = p.state.settled;
      expect(settledIdx.length).toBeGreaterThan(0);
    }
  });
});

describe("ds.sorting：输入校验", () => {
  it("少于 2 个数报错", () => {
    const sim = sorting.simulate({ algorithm: "bubble", data: "5" });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path === "data")).toBe(true);
  });

  it("超出 1–99 报错", () => {
    const sim = sorting.simulate({ algorithm: "bubble", data: "1, 200" });
    expect(sim.validate().some((i) => i.path.startsWith("data["))).toBe(true);
  });

  it("未知算法报错", () => {
    const sim = sorting.simulate({ algorithm: "heap" as SortAlgorithm, data: "1,2" });
    expect(sim.validate().some((i) => i.path === "algorithm")).toBe(true);
  });
});