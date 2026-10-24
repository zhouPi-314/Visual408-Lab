import { describe, expect, it } from "vitest";
import { createPlayer } from "../src/player";
import { module } from "../src/modules/cache-direct-mapped";
import { validate } from "../src/modules/cache-direct-mapped/sim";

const run = (accesses: string[]) =>
  module.simulate({ ...module.defaultInput, accesses });

describe("co.cache-direct-mapped：地址划分", () => {
  it("默认参数下 tag/index/offset 位数正确", () => {
    // 16 位地址 / 16 B 块 / 8 行 → offset 4 位、index 3 位、tag 9 位
    const sim = run(["0x0A3"]);
    const first = sim.frames[0]!;
    expect(first.event).toMatchObject({ type: "SPLIT", index: 2, tag: 0x1, offset: 0x3 });
  });

  it("同一 index 的不同块会互相踢出（冲突缺失）", () => {
    const sim = run(["0x0A3", "0x1A3", "0x2A3"]);
    const tags = sim.frames
      .filter((f) => f.event.type === "SPLIT")
      .map((f) => (f.event as { tag: number }).tag);
    expect(tags).toEqual([0x1, 0x3, 0x5]);
    const done = sim.frames.at(-1)!.event;
    expect(done).toEqual({ type: "DONE", hits: 0, misses: 3 });
  });
});

describe("co.cache-direct-mapped：黄金用例（docs/modules/first-modules-spec.md §2.5）", () => {
  const sim = run(["0x0A3", "0x1A3", "0x2A3", "0x0A3"]);

  it("四次访问全部缺失：1 次强制 + 3 次冲突", () => {
    const done = sim.frames.at(-1)!.event;
    expect(done).toEqual({ type: "DONE", hits: 0, misses: 4 });
    const misses = sim.frames.filter((f) => f.event.type === "MISS").map((f) => f.event);
    expect(misses).toHaveLength(4);
    expect(misses[0]).toMatchObject({ cause: "compulsory" });
    expect(misses.slice(1).every((m) => (m as { cause: string }).cause === "conflict")).toBe(true);
  });

  it("第三次访问同一地址仍然缺失（本题最重要的教学点）", () => {
    const splitFrames = sim.frames.filter((f) => f.event.type === "SPLIT");
    expect(splitFrames).toHaveLength(4);
    // 第 4 次访问 0x0A3 时，第 2 行已被 tag=0x5 的块占用
    const fourth = sim.frames.filter((f) => f.event.type === "PROBE")[3]!.event;
    expect(fourth).toMatchObject({ type: "PROBE", line: 2, valid: true, tag: 0x5 });
  });

  it("第 5 次访问同一地址才命中", () => {
    const sim5 = run(["0x0A3", "0x1A3", "0x2A3", "0x0A3", "0x0A3"]);
    expect(sim5.frames.at(-1)!.event).toEqual({ type: "DONE", hits: 1, misses: 4 });
  });

  it("每帧状态是不可变快照（回退不依赖重放）", () => {
    const states = sim.frames.map((f) => JSON.stringify(f.state.lines));
    const firstState = states[0]!;
    const lastState = states.at(-1)!;
    expect(firstState).not.toEqual(lastState);
    // 第一帧时所有行都无效
    expect(sim.frames[0]!.state.lines.every((l) => !l.valid)).toBe(true);
  });
});

describe("co.cache-direct-mapped：输入校验", () => {
  it("块大小非 2 的幂时报错且不产生帧", () => {
    const issues = validate({ addrBits: 16, blockBytes: 12, lines: 8, accesses: ["0x0A3"] });
    expect(issues.some((i) => i.path === "blockBytes" && i.severity === "error")).toBe(true);
    const sim = module.simulate({ addrBits: 16, blockBytes: 12, lines: 8, accesses: ["0x0A3"] });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().length).toBeGreaterThan(0);
  });

  it("地址超出位宽时报错", () => {
    const issues = validate({ addrBits: 12, blockBytes: 16, lines: 8, accesses: ["0xFFF0"] });
    expect(issues.some((i) => i.path === "accesses[0]")).toBe(true);
  });

  it("空访问序列报错", () => {
    const issues = validate({ addrBits: 16, blockBytes: 16, lines: 8, accesses: [] });
    expect(issues.some((i) => i.path === "accesses")).toBe(true);
  });
});

describe("player：六方法协议", () => {
  const sim = run(["0x0A3", "0x1A3"]);
  const p = createPlayer(sim);

  it("step/back/reset 边界安全", () => {
    p.initialize();
    expect(p.index).toBe(0);
    p.back();
    expect(p.index).toBe(0);
    for (let i = 0; i < 100; i++) p.step();
    expect(p.index).toBe(p.length - 1);
    p.reset();
    expect(p.index).toBe(0);
  });

  it("serialize 可复原输入与位置", () => {
    p.goto(3);
    const parsed = JSON.parse(p.serialize());
    expect(parsed.input.accesses).toEqual(["0x0A3", "0x1A3"]);
    expect(parsed.index).toBe(3);
  });

  it("goto 越界被钳制", () => {
    p.goto(-5);
    expect(p.index).toBe(0);
    p.goto(9999);
    expect(p.index).toBe(p.length - 1);
  });
});
