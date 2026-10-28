import type { FieldDef } from "../../view";
import type { GenericModuleDef } from "../../view";
import type { Issue } from "../../protocol";
import { bad, buildSimulation, type FrameSpec } from "./kit";

const M = (id: string, subject: "ds" | "co", title: string, summary: string, takeaway: string, fields: FieldDef[]) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  summary,
  takeaway,
  fields,
});

/* 1. Dijkstra */
const dijkstra: GenericModuleDef<any> = (() => {
  const EDGES: [number, number, number][] = [[0,1,10],[0,4,5],[4,1,3],[4,3,9],[3,2,4],[1,2,1]];
  const N = 5;
  const base = M("ds.dijkstra", "ds", "Dijkstra 单源最短路", "每次取出未确定的最小距离顶点，松弛它的出边。", "贪心成立的前提是边权非负",
    [{ key: "start", label: "源点", type: "select", options: [0,1,2,3,4].map((v) => ({ value: String(v), label: "顶点 " + v })) }]);
  return {
    ...base,
    defaultInput: { start: "0" },
    simulate(input: any) {
      const s = Number(input.start);
      const issues: Issue[] = [];
      const dist = Array(N).fill(Infinity);
      const done = Array(N).fill(false);
      dist[s] = 0;
      const specs: FrameSpec[] = [];
      const view = (hot: number) => ({
        kind: "bars" as const, label: "当前最短距离", max: 20,
        items: dist.map((d: number, i: number) => ({ label: "v" + i, value: d === Infinity ? 0 : d, state: (done[i] ? "done" : i === hot ? "active" : "idle") as any })),
      });
      for (let k = 0; k < N; k++) {
        let u = -1;
        for (let i = 0; i < N; i++) if (!done[i] && (u === -1 || dist[i] < dist[u]!)) u = i;
        if (u === -1 || dist[u] === Infinity) break;
        done[u] = true;
        specs.push({ type: "SELECT", narration: `选出未确定顶点中距离最小的 v${u}（dist=${dist[u]}）`, views: [view(u)] });
        for (const [a, b, w] of EDGES) {
          if (a !== u) continue;
          if (dist[a]! + w < dist[b]!) {
            dist[b] = dist[a]! + w;
            specs.push({ type: "RELAX", narration: `松弛 v${a}→v${b}：dist[v${b}] 更新为 ${dist[b]}`, views: [view(b)] });
          }
        }
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 2. 拓扑排序 */
const topological: GenericModuleDef<any> = (() => {
  const E: [number, number][] = [[0,1],[0,2],[1,3],[2,3],[3,4]];
  const N = 5;
  const base = M("ds.topological", "ds", "拓扑排序（Kahn 算法）", "不断取出入度为 0 的顶点，删掉它的出边。", "有环时会有顶点永远进不了队列",
    [{ key: "note", label: "说明", type: "text" }]);
  return {
    ...base,
    defaultInput: { note: "DAG：0→1,0→2,1→3,2→3,3→4" },
    simulate(input: any) {
      const indeg = Array(N).fill(0);
      for (const [, b] of E) indeg[b]! += 1;
      const queue: number[] = [];
      for (let i = 0; i < N; i++) if (indeg[i] === 0) queue.push(i);
      const order: number[] = [];
      const specs: FrameSpec[] = [];
      const view = () => ({
        kind: "chips" as const, label: "入度",
        items: indeg.map((d, i) => ({ text: String(d), sub: "v" + i, state: d === 0 ? "active" as const : "idle" as const })),
      });
      specs.push({ type: "INIT", narration: `初始入度为 0 的顶点：${queue.join(", ")}`, views: [view()] });
      while (queue.length) {
        const u = queue.shift()!;
        order.push(u);
        specs.push({ type: "POP", narration: `取出 v${u}，加入拓扑序列`, views: [view()], metrics: [{ label: "已输出", value: order.length }] });
        for (const [a, b] of E) {
          if (a !== u) continue;
          indeg[b]! -= 1;
          if (indeg[b] === 0) queue.push(b);
          specs.push({ type: "DEC", narration: `删除边 v${a}→v${b}，v${b} 入度变为 ${indeg[b]}`, views: [view()] });
        }
      }
      specs.push({ type: "DONE", narration: `拓扑序列：${order.join(" → ")}`, views: [view(), { kind: "chips", label: "拓扑序列", items: order.map((x) => ({ text: "v" + x, state: "done" as const })) }], metrics: [{ label: "序列长度", value: order.length, tone: order.length === N ? "good" : "bad" }] });
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 3. 并查集 */
const unionFind: GenericModuleDef<any> = (() => {
  const base = M("ds.union-find", "ds", "并查集与路径压缩", "按秩合并 + 路径压缩，几乎常数时间判断连通。", "路径压缩把查找链直接压平",
    [{ key: "pairs", label: "合并关系（a-b，逗号分隔）", type: "text" }]);
  return {
    ...base,
    defaultInput: { pairs: "0-1, 2-3, 1-3" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const pairs = input.pairs.split(/[,\s]+/).filter(Boolean).map((s: string) => s.split("-").map(Number));
      if (pairs.some((p: number[]) => p.length !== 2 || p.some((x) => !Number.isInteger(x) || x < 0))) issues.push(bad("pairs", "格式应为 a-b"));
      const n = Math.max(...pairs.flat(), 0) + 1;
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x: number): number => { let r = x; while (parent[r] !== r) r = parent[r]!; while (parent[x] !== r) { const nx = parent[x]!; parent[x] = r; x = nx; } return r; };
      const specs: FrameSpec[] = [];
      const view = (hot: number[]) => ({ kind: "chips" as const, label: "parent 数组", items: parent.map((p, i) => ({ text: String(p), sub: "v" + i, state: hot.includes(i) ? "active" as const : p === i ? "done" as const : "idle" as const })) });
      specs.push({ type: "INIT", narration: "初始每个元素自成一个集合", views: [view([])] });
      for (const [a, b] of pairs) {
        const ra = find(a), rb = find(b);
        if (ra === rb) { specs.push({ type: "SKIP", narration: `${a} 与 ${b} 已在同一集合（根 ${ra}）`, views: [view([a, b])] }); continue; }
        parent[ra] = rb;
        specs.push({ type: "UNION", narration: `合并两个集合：根 ${ra} 指向 ${rb}`, views: [view([a, b])] });
      }
      const roots = new Set(Array.from({ length: n }, (_, i) => find(i)));
      specs.push({ type: "DONE", narration: `最终有 ${roots.size} 个连通分量`, views: [view([])], metrics: [{ label: "连通分量", value: roots.size }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 4. KMP next 数组 */
const kmp: GenericModuleDef<any> = (() => {
  const base = M("ds.kmp-next", "ds", "KMP 的前缀函数", "next[i] 是模式串前 i+1 个字符的最长相等前后缀长度。", "失配时跳 next[i-1] 而不是回到开头",
    [{ key: "pattern", label: "模式串", type: "text" }]);
  return {
    ...base,
    defaultInput: { pattern: "ababaca" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const p = String(input.pattern ?? "");
      if (!/^[a-zA-Z]{2,16}$/.test(p)) issues.push(bad("pattern", "模式串需为 2–16 个字母"));
      const next = Array(p.length).fill(0);
      const specs: FrameSpec[] = [];
      for (let i = 1, k = 0; i < p.length; i++) {
        while (k > 0 && p[i] !== p[k]) k = next[k - 1];
        if (p[i] === p[k]) k += 1;
        next[i] = k;
        specs.push({ type: "STEP", narration: `i=${i}（${p[i]}）：最长相等前后缀长度 = ${k}`, views: [{ kind: "chips", label: "模式串", items: p.split("").map((ch, j) => ({ text: ch, sub: j <= i ? String(next[j]) : "", state: j === i ? "active" as const : "idle" as const })) }], metrics: [{ label: "next[" + i + "]", value: k }] });
      }
      specs.push({ type: "DONE", narration: `next = [${next.join(",")}]`, views: [{ kind: "chips", label: "next 数组", items: next.map((v, i) => ({ text: String(v), sub: p[i], state: "done" as const })) }], metrics: [{ label: "next", value: next.join(",") }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 5. Cache 写策略 */
const cacheWrite: GenericModuleDef<any> = (() => {
  const base = M("co.cache-write", "co", "写直达 vs 写回", "每次写都写主存，还是只在换出脏块时写主存。", "写回需要脏位，换出时才付出代价",
    [{ key: "writes", label: "写入次数", type: "select", options: [50, 100, 200].map((v) => ({ value: String(v), label: String(v) })) }]);
  return {
    ...base,
    defaultInput: { writes: "100" },
    simulate(input: any) {
      const w = Number(input.writes);
      const evictions = Math.round(w * 0.08);
      const specs: FrameSpec[] = [
        { type: "WT", narration: `写直达：${w} 次写入 → ${w} 次主存写`, views: [{ kind: "bars", label: "主存写次数", max: w, items: [{ label: "写直达", value: w, state: "bad" }] }], metrics: [{ label: "主存写", value: w }] },
        { type: "WB", narration: `写回：只有 ${evictions} 个脏块被换出时才写主存`, views: [{ kind: "bars", label: "主存写次数", max: w, items: [{ label: "写直达", value: w, state: "bad" }, { label: "写回", value: evictions, state: "done" }] }], metrics: [{ label: "主存写", value: evictions }] },
        { type: "DONE", narration: `写回把主存写减少到 ${((evictions / w) * 100).toFixed(0)}%，代价是 cache 与主存可能不一致`, views: [{ kind: "fields", items: [{ text: String(w), sub: "写直达" }, { text: String(evictions), sub: "写回" }, { text: ((evictions / w) * 100).toFixed(0) + "%", sub: "占比", state: "active" }] }], metrics: [{ label: "减少", value: (100 - (evictions / w) * 100).toFixed(0) + "%" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 6. 指令周期 */
const instructionCycle: GenericModuleDef<any> = (() => {
  const base = M("co.instruction-cycle", "co", "指令周期的四个阶段", "取指、间址、执行、中断，每段占用不同机器周期。", "间接寻址会多一次访存",
    [{ key: "mode", label: "寻址方式", type: "select", options: [{ value: "direct", label: "直接寻址" }, { value: "indirect", label: "间接寻址" }] }]);
  return {
    ...base,
    defaultInput: { mode: "indirect" },
    simulate(input: any) {
      const indirect = input.mode === "indirect";
      const span = indirect ? 12 : 9;
      const specs: FrameSpec[] = [
        { type: "FETCH", narration: "取指周期：PC → MAR → 主存 → MDR → IR，PC+1", views: [{ kind: "timeline", label: "机器周期", span, segments: [{ start: 0, end: 3, label: "取指", state: "active" }] }] },
        ...(indirect ? [{ type: "INDIRECT", narration: "间址周期：用形式地址再访存一次，取出有效地址", views: [{ kind: "timeline", label: "机器周期", span, segments: [{ start: 0, end: 3, label: "取指", state: "done" }, { start: 3, end: 6, label: "间址", state: "active" }] }], metrics: [{ label: "访存次数", value: 2 }] }] as FrameSpec[] : []),
        { type: "EXECUTE", narration: "执行周期：完成运算或访存", views: [{ kind: "timeline", label: "机器周期", span, segments: [{ start: 0, end: 3, label: "取指", state: "done" }, ...(indirect ? [{ start: 3, end: 6, label: "间址", state: "done" as const }] : []), { start: indirect ? 6 : 3, end: indirect ? 9 : 6, label: "执行", state: "active" }] }] },
        { type: "INTERRUPT", narration: "中断周期（若有中断请求）：保存断点、转中断服务", views: [{ kind: "timeline", label: "机器周期", span, segments: [{ start: 0, end: 3, label: "取指", state: "done" }, ...(indirect ? [{ start: 3, end: 6, label: "间址", state: "done" as const }] : []), { start: indirect ? 6 : 3, end: indirect ? 9 : 6, label: "执行", state: "done" }, { start: indirect ? 9 : 6, end: indirect ? 12 : 9, label: "中断", state: "warn" }] }], metrics: [{ label: "总周期", value: indirect ? 12 : 9 }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 7. 总线仲裁 */
const busArbitration: GenericModuleDef<any> = (() => {
  const base = M("co.bus-arbitration", "co", "总线仲裁：链式 / 计数器 / 独立请求", "设备越多，链式查询越慢，独立请求最快但线最多。", "仲裁时间与线数是权衡",
    [{ key: "devices", label: "设备数", type: "select", options: [4, 8, 16].map((v) => ({ value: String(v), label: String(v) })) }]);
  return {
    ...base,
    defaultInput: { devices: "8" },
    simulate(input: any) {
      const n = Number(input.devices);
      const chain = n, counter = Math.ceil(Math.log2(n)), indep = 1;
      const specs: FrameSpec[] = [
        { type: "CHAIN", narration: `链式查询：最坏要逐级传递 ${chain} 个周期`, views: [{ kind: "bars", label: "仲裁时间（周期）", max: chain, items: [{ label: "链式", value: chain, state: "bad" }] }], metrics: [{ label: "链式", value: chain }] },
        { type: "COUNTER", narration: `计数器定时查询：${counter} 位计数 → ${counter} 个周期`, views: [{ kind: "bars", label: "仲裁时间（周期）", max: chain, items: [{ label: "链式", value: chain, state: "bad" }, { label: "计数器", value: counter, state: "warn" }] }], metrics: [{ label: "计数器", value: counter }] },
        { type: "INDEP", narration: `独立请求：每个设备一对线，${indep} 个周期裁决`, views: [{ kind: "bars", label: "仲裁时间（周期）", max: chain, items: [{ label: "链式", value: chain, state: "bad" }, { label: "计数器", value: counter, state: "warn" }, { label: "独立", value: indep, state: "done" }] }], metrics: [{ label: "独立", value: indep }, { label: "线数", value: 2 * n }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 8. RAID */
const raid: GenericModuleDef<any> = (() => {
  const base = M("co.raid", "co", "RAID 0 / 1 / 5 的容量与可靠性", "同样的磁盘数，不同级别在容量、冗余、并行度上取舍不同。", "RAID5 用一块盘的容量换校验",
    [
      { key: "level", label: "RAID 级别", type: "select", options: [{ value: "0", label: "RAID 0" }, { value: "1", label: "RAID 1" }, { value: "5", label: "RAID 5" }] },
      { key: "disks", label: "磁盘数", type: "select", options: [4, 6].map((v) => ({ value: String(v), label: String(v) })) },
    ]);
  return {
    ...base,
    defaultInput: { level: "5", disks: "4" },
    simulate(input: any) {
      const n = Number(input.disks), level = input.level;
      const usable = level === "0" ? n : level === "1" ? n / 2 : n - 1;
      const fail = level === "0" ? 0 : 1;
      const specs: FrameSpec[] = [
        { type: "LAYOUT", narration: `RAID${level}：${n} 块盘，可用容量 ${usable} 块盘`, views: [{ kind: "chips", label: "磁盘", items: Array.from({ length: n }, (_, i) => ({ text: "D" + i, state: level === "5" && i === n - 1 ? "warn" as const : "done" as const })) }] },
        { type: "CAPACITY", narration: `可用容量 = ${usable} 块盘，冗余 = ${fail} 块盘`, views: [{ kind: "bars", label: "容量（块盘）", max: n, items: [{ label: "可用", value: usable, state: "done" }, { label: "冗余", value: n - usable, state: "warn" }] }], metrics: [{ label: "可用", value: usable }, { label: "容错", value: fail }] },
        { type: "DONE", narration: level === "0" ? "RAID0 无冗余，任一盘坏就全丢" : `RAID${level} 可容忍 ${fail} 块盘故障`, views: [{ kind: "fields", items: [{ text: "RAID" + level, sub: "级别" }, { text: String(usable), sub: "可用盘" }, { text: String(fail), sub: "容错", state: "active" }] }], metrics: [{ label: "可用容量", value: usable }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch4 = { dijkstra, topological, unionFind, kmp, cacheWrite, instructionCycle, busArbitration, raid };