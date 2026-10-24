import { describe, expect, it } from "vitest";
import { module as search } from "../src/modules/search";

const run = (mode: "sequential" | "binary", target: number, data = "1, 3, 5, 7, 9, 11") =>
  search.simulate({ mode, target, data });

const last = (mode: "sequential" | "binary", target: number, data?: string) => run(mode, target, data).frames.at(-1)!.state;

describe("ds.search：折半查找", () => {
  it("1..11 找 7：3 次比较，位置 3", () => {
    const s = last("binary", 7);
    expect(s.found).toBe(3);
    expect(s.compares).toBe(3);
  });

  it("找最小值 1：2 次比较（mid=2 偏大 → mid=0 命中）", () => {
    const s = last("binary", 1);
    expect(s.found).toBe(0);
    expect(s.compares).toBe(2);
  });

  it("找不到时区间会收缩为空", () => {
    const s = last("binary", 8);
    expect(s.found).toBeUndefined();
    expect(s.low).toBeGreaterThan(s.high);
  });

  it("每次比较后排除的元素单调增加", () => {
    const frames = run("binary", 7).frames.filter((f) => f.event.type === "NARROW");
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.state.eliminated.length).toBeGreaterThan(frames[i - 1]!.state.eliminated.length);
    }
  });
});

describe("ds.search：顺序查找", () => {
  it("找到 7 需要 4 次比较", () => {
    const s = last("sequential", 7);
    expect(s.found).toBe(3);
    expect(s.compares).toBe(4);
  });

  it("找不到时比较次数等于元素个数", () => {
    expect(last("sequential", 100).compares).toBe(6);
  });
});

describe("ds.search：校验", () => {
  it("折半查找要求升序", () => {
    expect(run("binary", 7, "11, 9, 7").validate().some((i) => i.path === "data")).toBe(true);
  });

  it("顺序查找允许无序", () => {
    expect(run("sequential", 7, "11, 9, 7").frames.length).toBeGreaterThan(0);
  });
});
