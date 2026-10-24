import { describe, expect, it } from "vitest";
import { module as cross } from "../src/modules/va-access-chain";
import { createCore, probeCache } from "../src/modules/cache-direct-mapped/core";
import type { CrossEvent } from "../src/modules/va-access-chain/types";

const run = (accesses?: string[]) =>
  cross.simulate({ ...cross.defaultInput, ...(accesses ? { accesses } : {}) });

const events = (accesses?: string[]): CrossEvent[] =>
  run(accesses).frames.map((f) => f.event);

const done = (accesses?: string[]) => {
  const last = run(accesses).frames.at(-1)!.event;
  return (last as { stats: Record<string, number> }).stats;
};

describe("cross.va-access-chain：地址换算（docs/modules/first-modules-spec.md §5.3）", () => {
  it("0x1A3C → VPN 1 / offset 0xA3C / PFN 5 / PA 0x5A3C", () => {
    const [first] = run().frames;
    expect(first!.event).toMatchObject({ type: "SPLIT", vpn: 1, offset: 0xa3c });
    const pa = run().frames.find((f) => f.event.type === "BUILD_PA")!.event as { pa: number };
    expect(pa.pa).toBe(0x5a3c);
  });

  it("Cache 三段拆分与 co 模块一致：index 3 / tag 0xB4", () => {
    const miss = events().find(
      (e) => e.type === "CACHE_MISS" || e.type === "CACHE_HIT",
    ) as { type: string; line: number };
    expect(miss.line).toBe(3);
    // tag/index 是在「查 Cache」阶段才填进 current 的，所以取 CACHE_* 帧
    const cacheFrame = run().frames.find(
      (f) =>
        (f.event.type === "CACHE_MISS" || f.event.type === "CACHE_HIT") &&
        f.state.current?.pa === 0x5a3c,
    )!;
    expect(cacheFrame.state.current).toMatchObject({ tag: 0xb4, index: 3 });
  });

  it("0x1A44 落在 index 4（同 tag、不同行）", () => {
    const sim = run();
    const probe = sim.frames.find((f) => f.event.type === "CACHE_MISS" && f.state.current?.pa === 0x5a44);
    expect(probe!.state.current!.index).toBe(4);
  });

  it("0x2A7C → PFN 7 / PA 0x7A7C / index 7 / tag 0xF4", () => {
    const sim = run();
    const f = sim.frames.find(
      (x) =>
        (x.event.type === "CACHE_MISS" || x.event.type === "CACHE_HIT") &&
        x.state.current?.pa === 0x7a7c,
    );
    expect(f!.state.current).toMatchObject({ pfn: 7, index: 7, tag: 0xf4 });
  });
});

describe("cross.va-access-chain：四层命中相互独立", () => {
  it("统计：TLB 命中 3 / 缺失 2；缺页 2；Cache 命中 2 / 缺失 3", () => {
    expect(done()).toEqual({ tlbHits: 3, tlbMisses: 2, pageFaults: 2, cacheHits: 2, cacheMisses: 3 });
  });

  it("第 1 次访问同时经历 TLB 缺失、缺页、Cache 缺失", () => {
    const seq = events().slice(0, 8).map((e) => e.type);
    expect(seq).toEqual([
      "SPLIT", "TLB_MISS", "PAGE_FAULT", "BUILD_PA", "CACHE_MISS", "MEMORY_ACCESS", "DELIVER", "SPLIT",
    ]);
  });

  it("第 3 次访问复用同一条链路且全部命中", () => {
    const all = events();
    const start = all.findIndex(
      (e, i) => e.type === "SPLIT" && i > 0 && (e as { va: number }).va === 0x1a3c,
    );
    const slice = all.slice(start, start + 5).map((e) => e.type);
    expect(slice).toEqual(["SPLIT", "TLB_HIT", "PAGE_HIT", "BUILD_PA", "CACHE_HIT"]);
  });

  it("TLB 命中不等于 Cache 命中（第 2 次访问可以证明）", () => {
    const all = events();
    const idx = all.findIndex((e, i) => i > 1 && e.type === "TLB_HIT");
    expect(all.slice(idx, idx + 4).map((e) => e.type)).toEqual([
      "TLB_HIT", "PAGE_HIT", "BUILD_PA", "CACHE_MISS",
    ]);
  });
});

describe("cross.va-access-chain：组合而非复制", () => {
  it("与 co 模块内核逐条对账（相同物理地址序列）", () => {
    const params = { addrBits: 16, blockBytes: 16, lines: 8 };
    const core = createCore(params);
    const direct = [0x5a3c, 0x5a44, 0x5a3c, 0x7a7c, 0x5a3c].map((pa) => probeCache(params, core, pa).outcome);

    const viaChain = events()
      .filter((e) => e.type === "CACHE_HIT" || e.type === "CACHE_MISS")
      .map((e) => (e.type === "CACHE_HIT" ? "hit" : "miss"));

    expect(viaChain).toEqual(direct);
  });

  it("每条访问都恰好有一个 SPLIT 与一个 DELIVER", () => {
    const all = events();
    expect(all.filter((e) => e.type === "SPLIT")).toHaveLength(5);
    expect(all.filter((e) => e.type === "DELIVER")).toHaveLength(5);
  });

  it("页表里没有的 VPN 给出段错误提示而不崩溃", () => {
    const sim = run(["0x9A00"]);
    expect(sim.frames.some((f) => f.narration.includes("段错误"))).toBe(true);
  });
});

describe("cross.va-access-chain：输入校验", () => {
  it("地址超过 16 位报错", () => {
    const sim = cross.simulate({ ...cross.defaultInput, accesses: ["0x1FFFF"] });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.path === "accesses[0]")).toBe(true);
  });

  it("TLB 项数越界报错", () => {
    const sim = cross.simulate({ ...cross.defaultInput, tlbEntries: 0 });
    expect(sim.validate().some((i) => i.path === "tlbEntries")).toBe(true);
  });
});
