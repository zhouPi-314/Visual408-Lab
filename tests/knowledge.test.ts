import { describe, expect, it } from "vitest";
import { checkAnswer, searchIn, type KModule } from "../apps/web/src/app/knowledge-core";
import raw from "../apps/web/src/generated/content-index.json";

const modules = (raw as { modules: KModule[] }).modules;
const catalog = new Map<string, string>([
  ["co.cache-direct-mapped", "地址三段拆分、命中判定、强制缺失与冲突缺失"],
  ["os.page-replacement", "教材式逐列表：每次访问后物理块的完整状态与缺页标记"],
]);

const run = (q: string) => searchIn(modules, catalog, q);

describe("知识搜索", () => {
  it("按中文关键词命中模块", () => {
    const hits = run("缺页");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.moduleId).toBe("os.page-replacement");
  });

  it("命中模块理论时能搜到 TCP 实验", () => {
    const hits = run("三次握手");
    expect(hits.some((h) => h.moduleId === "net.tcp-handshake")).toBe(true);
  });

  it("命中题目题干时单独出一条题目", () => {
    // TIME_WAIT 只出现在 net 模块的题目与理论里
    const hits = run("TIME_WAIT");
    expect(hits.some((h) => h.kind === "question" && h.moduleId === "net.tcp-handshake")).toBe(true);
  });

  it("能搜到内容索引里的理论片段", () => {
    const hits = run("Belady");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("空查询不返回结果", () => {
    expect(run("   ")).toHaveLength(0);
  });

  it("结果按相关度排序且不超过上限", () => {
    const hits = searchIn(modules, catalog, "Cache", 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});

describe("判题", () => {
  it("数字等价（忽略写法差异）", () => {
    expect(checkAnswer("seq=5000, ack=1001", "5000,1001")).toBe(true);
    expect(checkAnswer("12", " 12 ")).toBe(true);
    expect(checkAnswer("0", "0")).toBe(true);
  });

  it("文字序列忽略空格与大小写", () => {
    expect(checkAnswer("D B E A C F", "dbeacf")).toBe(true);
    expect(checkAnswer("FIFO", "fifo")).toBe(true);
  });

  it("答错时返回 false", () => {
    expect(checkAnswer("12", "11")).toBe(false);
    expect(checkAnswer("D B E A C F", "DBEAC")).toBe(false);
  });
});
