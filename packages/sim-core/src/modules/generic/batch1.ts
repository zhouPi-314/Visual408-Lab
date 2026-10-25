import type { FieldDef, ViewData } from "../../view";
import type { GenericModuleDef } from "../../view";
import { bad, buildSimulation, intIn, type FrameSpec } from "./kit";

const M = (id: string, subject: "ds" | "co", title: string, summary: string, takeaway: string, fields: FieldDef[]) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  summary,
  takeaway,
  fields,
});

/* ---------------- 1. 栈与队列 ---------------- */
const stackQueue: GenericModuleDef<any> = (() => {
  const base = M(
    "ds.stack-queue",
    "ds",
    "栈与队列的操作对比",
    "同一串入/出指令，在栈（后进先出）与队列（先进先出）上的不同结果。",
    "栈顶在尾部，队首在头部",
    [{ key: "ops", label: "操作序列（push 5, pop, enqueue 3, dequeue）", type: "text" as const }],
  );
  interface Input { ops: string }
  return {
    ...base,
    defaultInput: { ops: "push 1, push 2, pop, enqueue 3, dequeue" } as Input,
    simulate(input: Input) {
      const issues = [];
      const ops = input.ops.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      if (ops.length === 0 || ops.length > 10) issues.push(bad("ops", "操作数需为 1–10 条"));
      const stack: number[] = [];
      const queue: number[] = [];
      const specs: FrameSpec[] = [{
        type: "START",
        narration: "开始：栈空、队列空",
        views: [
          { kind: "chips", label: "栈（LIFO，栈顶在右）", items: [] },
          { kind: "chips", label: "队列（FIFO，队首在左）", items: [] },
        ],
        metrics: [{ label: "栈长", value: 0 }, { label: "队长", value: 0 }],
      }];
      for (const raw of ops) {
        const [cmd, arg] = raw.split(/\s+/);
        const v = Number(arg);
        let note = "";
        if (cmd === "push") { stack.push(v); note = `push(${v}) → 压入栈顶`; }
        else if (cmd === "pop") { const x = stack.pop(); note = `pop() → 弹出栈顶 ${x ?? "（空）"}`; }
        else if (cmd === "enqueue") { queue.push(v); note = `enqueue(${v}) → 放到队尾`; }
        else if (cmd === "dequeue") { const x = queue.shift(); note = `dequeue() → 取出队首 ${x ?? "（空）"}`; }
        else { issues.push(bad("ops", `无法识别的操作：${raw}`)); continue; }
        specs.push({
          type: cmd.toUpperCase(),
          narration: note,
          views: [
            { kind: "chips", label: "栈（LIFO，栈顶在右）", items: stack.map((x, i) => ({ text: String(x), state: i === stack.length - 1 ? "active" : "idle" })) },
            { kind: "chips", label: "队列（FIFO，队首在左）", items: queue.map((x, i) => ({ text: String(x), state: i === 0 ? "active" : "idle" })) },
          ],
          metrics: [{ label: "栈长", value: stack.length }, { label: "队长", value: queue.length }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 2. 大根堆插入 ---------------- */
const heap: GenericModuleDef<any> = (() => {
  const base = M(
    "ds.heap",
    "ds",
    "大根堆的插入与上浮",
    "每次插入后与父结点比较，比父大就交换，直到满足堆序。",
    "插入只看一条父链，代价 O(logn)",
    [{ key: "values", label: "依次插入的整数（逗号分隔）", type: "text" as const }],
  );
  interface Input { values: string }
  return {
    ...base,
    defaultInput: { values: "10, 20, 15, 30, 25" } as Input,
    simulate(input: Input) {
      const issues = [];
      const nums = input.values.split(/[,\s]+/).filter(Boolean).map(Number);
      if (nums.length < 2 || nums.length > 12) issues.push(bad("values", "需要 2–12 个数"));
      if (nums.some((n) => !Number.isInteger(n))) issues.push(bad("values", "只能填整数"));
      const a: number[] = [];
      const specs: FrameSpec[] = [];
      const view = (hot: number[]) => ({
        kind: "bars" as const,
        label: "堆的数组表示（层序）",
        max: Math.max(...nums, 1),
        items: a.map((v, i) => ({ label: `#${i}`, value: v, state: hot.includes(i) ? ("active" as const) : ("idle" as const) })),
      });
      nums.forEach((v, k) => {
        a.push(v);
        let i = a.length - 1;
        specs.push({ type: "INSERT", narration: `插入 ${v} 到末尾（下标 ${i}）`, views: [view([i])], metrics: [{ label: "堆大小", value: a.length }] });
        while (i > 0) {
          const p = Math.floor((i - 1) / 2);
          if (a[p]! >= a[i]!) break;
          specs.push({ type: "COMPARE", narration: `a[${i}]=${a[i]} > 父 a[${p}]=${a[p]} → 需要交换`, views: [view([i, p])] });
          const t = a[i]!; a[i] = a[p]!; a[p] = t;
          specs.push({ type: "SWAP", narration: `交换 ${a[p]} 与 ${a[i]}，继续向上比较`, views: [view([p])] });
          i = p;
        }
        specs.push({ type: "SETTLE", narration: `第 ${k + 1} 个元素就位，当前堆顶 ${a[0]}`, views: [view([0])], metrics: [{ label: "堆大小", value: a.length }, { label: "堆顶", value: a[0]! }] });
      });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 3. 哈希表线性探测 ---------------- */
const hashTable: GenericModuleDef<any> = (() => {
  const base = M(
    "ds.hash-table",
    "ds",
    "哈希表：除留余数与线性探测",
    "H(key)=key mod m，冲突就往后找空槽，逐步看到探测路径。",
    "冲突次数直接决定查找长度",
    [
      { key: "keys", label: "插入的键（逗号分隔）", type: "text" as const },
      { key: "size", label: "表长 m", type: "select" as const, options: [7, 11, 13].map((v) => ({ value: String(v), label: String(v) })) },
    ],
  );
  interface Input { keys: string; size: string }
  return {
    ...base,
    defaultInput: { keys: "12, 19, 26, 33", size: "7" } as Input,
    simulate(input: Input) {
      const issues = [];
      const m = Number(input.size);
      const keys = input.keys.split(/[,\s]+/).filter(Boolean).map(Number);
      if (keys.length < 2 || keys.length > m) issues.push(bad("keys", `键数量需为 2–${m}`));
      if (keys.some((k) => !Number.isInteger(k) || k < 0)) issues.push(bad("keys", "键必须是非负整数"));
      const slot: (number | null)[] = Array.from({ length: m }, () => null);
      const probes: number[] = [];
      const specs: FrameSpec[] = [];
      const view = (hot: number[]) => ({
        kind: "chips" as const,
        label: `哈希表（m=${m}）`,
        items: slot.map((v, i) => ({ text: v === null ? "空" : String(v), sub: String(i), state: hot.includes(i) ? ("active" as const) : v === null ? ("idle" as const) : ("done" as const) })),
      });
      specs.push({ type: "START", narration: `表长 ${m}，初始全空`, views: [view([])] });
      keys.forEach((k) => {
        const h0 = k % m;
        let i = h0; let n = 0;
        specs.push({ type: "HASH", narration: `H(${k}) = ${k} mod ${m} = ${h0}`, views: [view([h0])] });
        while (slot[i] !== null && n < m) {
          n += 1;
          specs.push({ type: "PROBE", narration: `第 ${i} 槽被 ${slot[i]} 占用 → 线性探测到 ${(i + 1) % m}`, views: [view([i])], metrics: [{ label: "本次冲突", value: n }] });
          i = (i + 1) % m;
        }
        slot[i] = k;
        probes.push(n);
        specs.push({ type: "PLACE", narration: `把 ${k} 放进第 ${i} 槽（冲突 ${n} 次）`, views: [view([i])], metrics: [{ label: "平均探测", value: (probes.reduce((x, y) => x + y, 0) / probes.length).toFixed(2) }] });
      });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 4. Kruskal 最小生成树 ---------------- */
const kruskal: GenericModuleDef<any> = (() => {
  const base = M(
    "ds.kruskal",
    "ds",
    "Kruskal 最小生成树",
    "按权值从小到大考察边，不成环就加入，并查集实时合并。",
    "判环靠并查集，选中 n−1 条边即结束",
    [{ key: "edges", label: "边（a-b:权，逗号分隔）", type: "text" as const }],
  );
  interface Input { edges: string }
  return {
    ...base,
    defaultInput: { edges: "0-1:4, 0-2:3, 1-2:1, 1-3:2, 2-3:5" } as Input,
    simulate(input: Input) {
      const issues = [];
      const parsed = input.edges.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => {
        const mres = s.match(/^(\d+)-(\d+):(\d+)$/);
        return mres ? { a: Number(mres[1]), b: Number(mres[2]), w: Number(mres[3]) } : null;
      });
      if (parsed.some((e) => e === null)) issues.push(bad("edges", "边格式应为 a-b:权"));
      const edges = parsed.filter((e): e is { a: number; b: number; w: number } => e !== null);
      const n = Math.max(...edges.flatMap((e) => [e.a, e.b])) + 1;
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
      const sets = () => {
        const map = new Map<number, number[]>();
        for (let i = 0; i < n; i++) { const r = find(i); map.set(r, [...(map.get(r) ?? []), i]); }
        return [...map.values()];
      };
      const sorted = [...edges].sort((x, y) => x.w - y.w);
      const chosen: { a: number; b: number; w: number }[] = [];
      const specs: FrameSpec[] = [];
      const edgeView = (state: (e: { a: number; b: number; w: number }) => "idle" | "active" | "done" | "bad"): ViewData => ({
        kind: "chips",
        label: "边（按权升序）",
        items: sorted.map((e) => ({ text: `${e.a}-${e.b}`, sub: `w=${e.w}`, state: state(e) })),
      });
      specs.push({
        type: "SORT",
        narration: `把 ${sorted.length} 条边按权值升序排列`,
        views: [edgeView(() => "idle"), { kind: "chips", label: "并查集", items: sets().map((s) => ({ text: s.join(",") })) }],
      });
      for (const e of sorted) {
        if (chosen.length === n - 1) break;
        const ra = find(e.a); const rb = find(e.b);
        if (ra === rb) {
          specs.push({ type: "REJECT", narration: `边 ${e.a}-${e.b}（w=${e.w}）：两端已连通，加入会成环 → 跳过`, views: [edgeView((x) => (x === e ? "bad" : chosen.includes(x) ? "done" : "idle")), { kind: "chips", label: "并查集", items: sets().map((s) => ({ text: s.join(",") })) }] });
        } else {
          parent[ra] = rb;
          chosen.push(e);
          specs.push({ type: "ACCEPT", narration: `边 ${e.a}-${e.b}（w=${e.w}）：合并两个集合 → 加入生成树`, views: [edgeView((x) => (x === e ? "active" : chosen.includes(x) ? "done" : "idle")), { kind: "chips", label: "并查集", items: sets().map((s) => ({ text: s.join(",") })) }], metrics: [{ label: "总权值", value: chosen.reduce((s, x) => s + x.w, 0) }, { label: "已选边", value: chosen.length }] });
        }
      }
      specs.push({ type: "DONE", narration: `最小生成树完成：总权 ${chosen.reduce((s, x) => s + x.w, 0)}`, views: [edgeView((x) => (chosen.includes(x) ? "done" : "idle"))], metrics: [{ label: "总权值", value: chosen.reduce((s, x) => s + x.w, 0) }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

export const batch1 = { stackQueue, heap, hashTable, kruskal };