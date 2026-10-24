import { describe, expect, it } from "vitest";
import { module as graph } from "../src/modules/graph-traversal";
import type { GraphMode } from "../src/modules/graph-traversal/types";

const GRAPH = "0-1, 0-2, 1-3, 2-3, 3-4";
const run = (mode: GraphMode, edges = GRAPH, start = 0, nodes = 5) =>
  graph.simulate({ nodes, edges, start, mode });

const order = (mode: GraphMode, edges = GRAPH, start = 0, nodes = 5) =>
  (run(mode, edges, start, nodes).frames.at(-1)!.event as { order: number[] }).order;

describe("ds.graph-traversal：遍历顺序", () => {
  it("BFS：按层推进 0,1,2,3,4", () => {
    expect(order("bfs")).toEqual([0, 1, 2, 3, 4]);
  });

  it("DFS：沿邻接点深入 0,1,3,2,4", () => {
    expect(order("dfs")).toEqual([0, 1, 3, 2, 4]);
  });

  it("从中间结点出发只覆盖连通分量", () => {
    expect(order("bfs", "0-1", 2, 4)).toEqual([2]);
  });

  it("环不会导致重复访问", () => {
    expect(order("bfs", "0-1, 1-2, 2-0", 0, 3)).toEqual([0, 1, 2]);
  });
});

describe("ds.graph-traversal：状态不变量", () => {
  it("每个结点最多被访问一次", () => {
    for (const mode of ["bfs", "dfs"] as GraphMode[]) {
      const v = run(mode).frames.at(-1)!.state.visited;
      expect(new Set(v).size).toBe(v.length);
    }
  });

  it("BFS 结束后队列为空、DFS 结束后栈为空", () => {
    for (const mode of ["bfs", "dfs"] as GraphMode[]) {
      expect(run(mode).frames.at(-1)!.state.frontier).toHaveLength(0);
    }
  });

  it("邻接矩阵对称，且边数等于对角外 1 的个数", () => {
    const s = run("bfs").frames[0]!.state;
    for (let i = 0; i < s.n; i++) {
      for (let j = 0; j < s.n; j++) expect(s.matrix[i]![j]).toBe(s.matrix[j]![i]);
    }
    const ones = s.matrix.flat().filter((x) => x === 1).length;
    expect(ones).toBe(5 * 2);
  });

  it("生成树的边数 = 访问结点数 − 1（连通图）", () => {
    const s = run("bfs").frames.at(-1)!.state;
    expect(s.treeEdges).toHaveLength(s.visited.length - 1);
  });
});

describe("ds.graph-traversal：输入校验", () => {
  it("边越界报错", () => {
    expect(run("bfs", "0-9").validate().some((i) => i.path.startsWith("edges["))).toBe(true);
  });

  it("起点越界报错", () => {
    expect(run("bfs", GRAPH, 9).validate().some((i) => i.path === "start")).toBe(true);
  });
});
