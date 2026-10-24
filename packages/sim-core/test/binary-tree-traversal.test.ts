import { describe, expect, it } from "vitest";
import { module as treeModule } from "../src/modules/binary-tree-traversal";
import { PRESET_TREE, treeHeight } from "../src/modules/binary-tree-traversal/sim";
import type { TreeOrder } from "../src/modules/binary-tree-traversal/types";

const run = (order: TreeOrder, tree = PRESET_TREE, mode: "recursive" | "iterative" = order === "level" ? "iterative" : "recursive") =>
  treeModule.simulate({ tree, order, mode });

const sequence = (order: TreeOrder, tree = PRESET_TREE) => {
  const sim = run(order, tree);
  const done = sim.frames.at(-1)!.event;
  return (done as { sequence: string[] }).sequence;
};

describe("ds.binary-tree-traversal：黄金向量（docs/modules/first-modules-spec.md §1.5）", () => {
  it("树形 A(B(D,E), C(_,F))，深度为 3", () => {
    expect(treeHeight(PRESET_TREE)).toBe(3);
  });

  it("先序 = A B D E C F", () => expect(sequence("pre")).toEqual(["A", "B", "D", "E", "C", "F"]));
  it("中序 = D B E A C F", () => expect(sequence("in")).toEqual(["D", "B", "E", "A", "C", "F"]));
  it("后序 = D E B F C A", () => expect(sequence("post")).toEqual(["D", "E", "B", "F", "C", "A"]));
  it("层序 = A B C D E F", () => expect(sequence("level")).toEqual(["A", "B", "C", "D", "E", "F"]));
});

describe("ds.binary-tree-traversal：栈/队列不变量", () => {
  it("任意时刻栈深度不超过树高", () => {
    const sim = run("in");
    const height = treeHeight(PRESET_TREE);
    for (const f of sim.frames) expect(f.state.stack.length).toBeLessThanOrEqual(height);
  });

  it("ENTER / RETURN 严格配对，结束时栈为空", () => {
    const sim = run("post");
    const last = sim.frames.at(-1)!.state;
    expect(last.stack).toHaveLength(0);
    const enters = sim.frames.filter((f) => f.event.type === "ENTER").length;
    const returns = sim.frames.filter((f) => f.event.type === "RETURN").length;
    expect(enters).toBe(6);
    expect(returns).toBe(6);
  });

  it("访问序列长度等于结点数，且无重复", () => {
    const sim = run("in");
    const done = sim.frames.at(-1)!.state.visited.map((v) => v.label);
    expect(done).toHaveLength(6);
    expect(new Set(done).size).toBe(6);
  });

  it("层序遍历不使用递归栈", () => {
    const sim = run("level");
    for (const f of sim.frames) expect(f.state.stack).toHaveLength(0);
  });
});

describe("ds.binary-tree-traversal：边界与校验", () => {
  it("单结点树三种序都是自己", () => {
    for (const order of ["pre", "in", "post"] as TreeOrder[]) {
      expect(sequence(order, ["A"])).toEqual(["A"]);
    }
  });

  it("空树给提示而不是报错", () => {
    const sim = treeModule.simulate({ tree: [], order: "pre", mode: "recursive" });
    expect(sim.validate().every((i) => i.severity === "warning")).toBe(true);
    expect(sim.frames).toHaveLength(1);
  });

  it("重复结点值报错", () => {
    const sim = treeModule.simulate({ tree: ["A", "A"], order: "pre", mode: "recursive" });
    expect(sim.frames).toHaveLength(0);
    expect(sim.validate().some((i) => i.message.includes("重复"))).toBe(true);
  });

  it("悬空结点报错", () => {
    const sim = treeModule.simulate({ tree: ["A", null, "C", "D"], order: "pre", mode: "recursive" });
    expect(sim.validate().some((i) => i.path === "tree[3]")).toBe(true);
  });

  it("层序 + 递归 被拒绝", () => {
    const sim = treeModule.simulate({ tree: ["A"], order: "level", mode: "recursive" });
    expect(sim.validate().some((i) => i.path === "mode")).toBe(true);
  });
});
