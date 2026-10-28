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

/* 1. BST 查找 */
const bstSearch: GenericModuleDef<any> = (() => {
  const LEVELS = [[50], [30, 70], [20, 40, 60, 80]];
  const CHILD: Record<number, [number | null, number | null]> = {
    50: [30, 70], 30: [20, 40], 70: [60, 80], 20: [null, null], 40: [null, null], 60: [null, null], 80: [null, null],
  };
  const base = {
    ...M("ds.bst-search", "ds", "二叉搜索树查找路径", "从根开始比大小，左小右大，路径就是比较序列。", "查找长度 = 路径上的结点数",
      [{ key: "target", label: "查找目标", type: "select" as const, options: [40, 45, 20, 70].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [
      { label: "命中：40", patch: { target: "40" } },
      { label: "未命中：45", patch: { target: "45" } },
      { label: "走最左：20", patch: { target: "20" } },
    ],
  };
  return {
    ...base,
    defaultInput: { target: "40" },
    simulate(input: any) {
      const target = Number(input.target);
      const path: number[] = [];
      let cur: number | null = 50;
      const specs: FrameSpec[] = [];
      const grid = (hot: number, found: boolean) => ({
        kind: "grid" as const,
        label: "这棵树（层序排列）",
        columns: ["第 1 层", "第 2 层", "第 3 层", "第 4 层"],
        rows: [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => {
          const v = LEVELS[r]?.[c];
          if (v === undefined) return { text: "" };
          return { text: String(v), state: v === hot ? ("active" as const) : path.includes(v) ? ("done" as const) : ("idle" as const) };
        })),
        activeRow: found ? 2 : 0,
      });
      specs.push({ type: "START", narration: `到 ${target}：从根 50 开始比较`, views: [grid(50, false)], metrics: [{ label: "比较次数", value: 0 }] });
      let steps = 0;
      while (cur !== null) {
        steps += 1;
        path.push(cur);
        if (cur === target) {
          specs.push({ type: "FOUND", narration: `第 ${steps} 次比较：${cur} == ${target} → 查找成功`, views: [grid(cur, true)], metrics: [{ label: "比较次数", value: steps }, { label: "结果", value: "命中", tone: "good" }] });
          break;
        }
        const pair: [number | null, number | null] = CHILD[cur]!;
        const next: number | null = target < cur ? pair[0] : pair[1];
        specs.push({ type: "STEP", narration: `第 ${steps} 次比较：${target} ${target < cur ? "<" : ">"} ${cur} → 去${target < cur ? "左" : "右"}子树`, views: [grid(cur, false)], metrics: [{ label: "比较次数", value: steps }] });
        cur = next;
        if (steps > 4) {
          specs.push({ type: "MISS", narration: `走到空指针：树中没有 ${target}`, views: [grid(-1, false)], metrics: [{ label: "比较次数", value: steps }, { label: "结果", value: "未命中", tone: "bad" }] });
          break;
        }
      }
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 2. Floyd */
const floyd: GenericModuleDef<any> = (() => {
  const INF = 999;
  const W = [
    [0, 5, INF, 10],
    [5, 0, 3, INF],
    [INF, 3, 0, 1],
    [10, INF, 1, 0],
  ];
  const base = {
    ...M("ds.floyd", "ds", "Floyd 全源最短路", "每轮允许经过一个中转点 k，矩阵逐格变小。", "三重循环，中间点在最外层",
      [{ key: "note", label: "图", type: "text" as const }]),
    presets: [{ label: "四结点样例", patch: { note: "" } }],
  };
  return {
    ...base,
    defaultInput: { note: "0-1:5, 1-2:3, 2-3:1, 0-3:10" },
    simulate(input: any) {
      const d = W.map((r) => [...r]);
      const specs: FrameSpec[] = [];
      for (let k = 0; k < 4; k++) {
        let changed = 0;
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            if (d[i]![k]! + d[k]![j]! < d[i]![j]!) { d[i]![j] = d[i]![k]! + d[k]![j]!; changed++; }
          }
        }
        specs.push({
          type: "ROUND",
          narration: k === 0 ? `允许经过 v0：本轮更新 ${changed} 个距离` : `允许经过 v${k}：本轮更新 ${changed} 个距离，v0→v3 现为 ${d[0]![3]}`,
          views: [{ kind: "matrix", label: "距离矩阵", columns: ["v0", "v1", "v2", "v3"], rowHeaders: ["v0", "v1", "v2", "v3"], rows: d.map((r) => r.map((x) => (x >= INF ? "∞" : x))), highlight: [[k, 0], [k, 1], [k, 2], [k, 3]] as [number, number][] }],
          metrics: [{ label: "d[0][3]", value: d[0]![3]! }, { label: "本轮更新", value: changed }],
        });
      }
      specs.push({ type: "DONE", narration: `四轮结束：v0→v3 最短路 ${d[0]![3]}（0→1→2→3）`, views: [{ kind: "matrix", label: "最终距离矩阵", columns: ["v0", "v1", "v2", "v3"], rowHeaders: ["v0", "v1", "v2", "v3"], rows: d.map((r) => r.map((x) => (x >= INF ? "∞" : x))) }], metrics: [{ label: "d[0][3]", value: d[0]![3]! }] });
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 3. Huffman */
const huffman: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.huffman", "ds", "哈夫曼树与带权路径长度", "每次合并最小的两个权值，WPL 就是所有叶子权值×深度之和。", "权值越小的叶子离根越远",
      [{ key: "weights", label: "权值序列", type: "text" as const }]),
    presets: [
      { label: "教科书样例", patch: { weights: "5, 9, 12, 13, 16, 45" } },
      { label: "四个字符", patch: { weights: "1, 2, 4, 8" } },
    ],
  };
  return {
    ...base,
    defaultInput: { weights: "5, 9, 12, 13, 16, 45" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const ws = String(input.weights).split(/[,\s]+/).filter(Boolean).map(Number);
      if (ws.length < 2 || ws.length > 8 || ws.some((w) => !Number.isInteger(w) || w <= 0)) issues.push(bad("weights", "需要 2–8 个正整数"));
      let pool = ws.map((w, i) => ({ w, depth: 0, label: "w" + i }));
      let wpl = 0;
      const specs: FrameSpec[] = [{ type: "INIT", narration: `初始森林：${ws.join(", ")}`, views: [{ kind: "bars", label: "权值", max: Math.max(...ws), items: ws.map((w, i) => ({ label: "w" + i, value: w })) }] }];
      while (pool.length > 1) {
        pool.sort((a, b) => a.w - b.w || a.label.localeCompare(b.label));
        const [a, b] = [pool.shift()!, pool.shift()!];
        wpl += a.w + b.w;
        const merged = { w: a.w + b.w, depth: 0, label: "(" + a.label + "+" + b.label + ")" };
        specs.push({
          type: "MERGE",
          narration: `合并最小的两个 ${a.w} 与 ${b.w} → 新结点 ${merged.w}`,
          views: [{ kind: "bars", label: "当前森林", max: Math.max(...pool.map((p) => p.w), merged.w), items: [...pool, merged].sort((x, y) => x.w - y.w).map((p) => ({ label: p.label.slice(0, 12), value: p.w, state: p === merged ? ("active" as const) : ("idle" as const) })) }],
          metrics: [{ label: "累计 WPL", value: wpl }],
        });
        pool.push(merged);
      }
      specs.push({ type: "DONE", narration: `合并完成：WPL = ${wpl}`, views: [{ kind: "fields", items: [{ text: String(wpl), sub: "WPL", state: "active" }, { text: String(ws.length), sub: "叶子数" }] }], metrics: [{ label: "WPL", value: wpl }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 4. 循环队列 */
const cyclicQueue: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.cyclic-queue", "ds", "循环队列的取模运算", "front 与 rear 都对容量取模，队满要牺牲一个单元。", "判满：(rear+1)%n == front",
      [{ key: "ops", label: "操作（入x / 出）", type: "text" as const }]),
    presets: [
      { label: "基本进出", patch: { ops: "入3, 入7, 出, 入1, 入4" } },
      { label: "环绕一圈", patch: { ops: "入1, 入2, 入3, 出, 出, 入4, 入5" } },
    ],
  };
  return {
    ...base,
    defaultInput: { ops: "入3, 入7, 出, 入1, 入4" },
    simulate(input: any) {
      const n = 8;
      const buf: (number | null)[] = Array(n).fill(null);
      let front = 0, rear = 0, count = 0;
      const issues: Issue[] = [];
      const ops = String(input.ops).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      const specs: FrameSpec[] = [];
      const view = () => ({ kind: "chips" as const, label: `循环队列（容量 ${n}，牺牲 1 格）`, items: buf.map((v, i) => ({ text: v === null ? "·" : String(v), sub: (i === front ? "F" : "") + (i === rear ? "R" : "") || String(i), state: i === front ? ("active" as const) : v !== null ? ("done" as const) : ("idle" as const) })) });
      specs.push({ type: "INIT", narration: `空队列：front=rear=0`, views: [view()], metrics: [{ label: "元素数", value: 0 }] });
      for (const op of ops) {
        if (op.startsWith("入")) {
          const v = Number(op.replace(/\D/g, "")) || 0;
          if ((rear + 1) % n === front) { specs.push({ type: "FULL", narration: "队满（牺牲一格判满），入队失败", views: [view()] }); continue; }
          buf[rear] = v; rear = (rear + 1) % n; count++;
          specs.push({ type: "ENQ", narration: `入队 ${v}：放在 rear=${(rear - 1 + n) % n}，rear 变为 ${rear}`, views: [view()], metrics: [{ label: "元素数", value: count }] });
        } else if (op.startsWith("出")) {
          if (front === rear) { specs.push({ type: "EMPTY", narration: "队空，出队失败", views: [view()] }); continue; }
          const v = buf[front]; buf[front] = null; front = (front + 1) % n; count--;
          specs.push({ type: "DEQ", narration: `出队 ${v}：front 变为 ${front}`, views: [view()], metrics: [{ label: "元素数", value: count }] });
        } else issues.push(bad("ops", `无法识别：${op}`));
      }
      specs.push({ type: "DONE", narration: `结束：front=${front}、rear=${rear}、元素 ${count} 个`, views: [view()], metrics: [{ label: "front", value: front }, { label: "rear", value: rear }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 5. 流水线时空图 */
const pipelineTiming: GenericModuleDef<any> = (() => {
  const STAGES = ["IF", "ID", "EX", "MEM", "WB"];
  const base = {
    ...M("co.pipeline-timing", "co", "流水线时空图", "五级流水线里，每条指令错开一个周期进入下一级。", "n 条指令耗时 n+4 个周期",
      [{ key: "n", label: "指令条数", type: "select" as const, options: [3, 5, 8].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "5 条指令", patch: { n: "5" } }, { label: "8 条指令", patch: { n: "8" } }],
  };
  return {
    ...base,
    defaultInput: { n: "5" },
    simulate(input: any) {
      const n = Number(input.n);
      const cycles = n + 4;
      const rows = Array.from({ length: n }, (_, i) => STAGES.map((s, k) => ({ text: s, state: "idle" as const })));
      const specs: FrameSpec[] = [];
      for (let c = 0; c < cycles; c++) {
        const grid = rows.map((row, i) => row.map((cell, k) => {
          const active = c - i === k;
          return active ? { text: cell.text, state: "active" as const } : cell.text ? { text: "", state: "idle" as const } : cell;
        }));
        specs.push({
          type: "CYCLE",
          narration: `第 ${c + 1} 个周期：${Array.from({ length: Math.min(n, c + 1) }, (_, i) => `I${i}:${STAGES[c - i]}`).filter((x) => !x.endsWith("undefined")).join("  ")}`,
          views: [{ kind: "grid", label: "时空图（行=指令，列=周期）", columns: Array.from({ length: cycles }, (_, i) => "T" + (i + 1)), rowHeaders: Array.from({ length: n }, (_, i) => "I" + i), rows: rows.map((row, i) => Array.from({ length: cycles }, (_, t) => { const k = t - i; return k >= 0 && k < 5 ? { text: STAGES[k]!, state: (t === c ? "active" : "done") as any } : { text: "" }; })) }],
          metrics: [{ label: "已完成", value: Math.max(0, c - 3) }, { label: "总周期", value: cycles }],
        });
      }
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 6. 三类缺失 */
const missTypes: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.cache-miss-types", "co", "三类缺失：强制 / 冲突 / 容量", "首次访问必然缺失；同 index 不同 tag 是冲突；容量不足是容量缺失。", "直接映射只有强制与冲突缺失",
      [{ key: "seq", label: "访问序列（块号）", type: "text" as const }]),
    presets: [
      { label: "冲突缺失样例", patch: { seq: "0, 8, 0, 8" } },
      { label: "强制缺失样例", patch: { seq: "0, 1, 2, 3" } },
    ],
  };
  return {
    ...base,
    defaultInput: { seq: "0, 8, 0, 8" },
    simulate(input: any) {
      const lines = 4;
      const seen = new Set<number>();
      const cache: (number | null)[] = Array(lines).fill(null);
      const counts = { compulsory: 0, conflict: 0 };
      const issues: Issue[] = [];
      const seq = String(input.seq).split(/[,\s]+/).filter(Boolean).map(Number);
      if (seq.length === 0 || seq.some((x) => !Number.isInteger(x) || x < 0)) issues.push(bad("seq", "请输入非负块号"));
      const specs: FrameSpec[] = [];
      seq.forEach((blk, i) => {
        const idx = blk % lines;
        const hit = cache[idx] === blk;
        if (!hit) {
          const kind = !seen.has(blk) ? "compulsory" : "conflict";
          counts[kind] += 1;
          cache[idx] = blk;
          specs.push({
            type: hit ? "HIT" : "MISS",
            narration: `第 ${i + 1} 次访问块 ${blk}：index=${idx}，${kind === "compulsory" ? "首次访问 → 强制缺失" : `上次被块 ${blk} 同 index 的其它块挤掉 → 冲突缺失`}`,
            views: [{ kind: "chips", label: "Cache 行（4 行直接映射）", items: cache.map((v, k) => ({ text: v === null ? "空" : String(v), sub: "行" + k, state: k === idx ? "active" as const : v === null ? "idle" as const : "done" as const })) }],
            metrics: [{ label: "强制", value: counts.compulsory }, { label: "冲突", value: counts.conflict }],
          });
        } else {
          specs.push({ type: "HIT", narration: `第 ${i + 1} 次访问块 ${blk}：命中`, views: [{ kind: "chips", label: "Cache 行", items: cache.map((v, k) => ({ text: v === null ? "空" : String(v), sub: "行" + k, state: k === idx ? "done" as const : "idle" as const })) }], metrics: [{ label: "强制", value: counts.compulsory }, { label: "冲突", value: counts.conflict }] });
        }
        seen.add(blk);
      });
      specs.push({ type: "DONE", narration: `共 ${seq.length} 次访问：强制缺失 ${counts.compulsory} 次，冲突缺失 ${counts.conflict} 次`, views: [{ kind: "fields", items: [{ text: String(counts.compulsory), sub: "强制", state: "warn" }, { text: String(counts.conflict), sub: "冲突", state: "bad" }] }], metrics: [{ label: "强制", value: counts.compulsory }, { label: "冲突", value: counts.conflict }, { label: "缺失率", value: ((counts.compulsory + counts.conflict) / seq.length * 100).toFixed(0) + "%" }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 7. 数据表示 */
const dataRepr: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.data-representation", "co", "原码 / 反码 / 补码 / 移码", "同一个负数，四种机器数的位串完全不同。", "补码 = 反码 + 1，移码 = 补码符号位取反",
      [{ key: "value", label: "十进制数", type: "select" as const, options: [-5, -1, 5, 127].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "-5（经典）", patch: { value: "-5" } }, { label: "+5", patch: { value: "5" } }],
  };
  return {
    ...base,
    defaultInput: { value: "-5" },
    simulate(input: any) {
      const W = 8;
      const x = Number(input.value);
      const mag = Math.abs(x).toString(2).padStart(W - 1, "0");
      const sign = x < 0 ? "1" : "0";
      const 原码 = sign + mag;
      const 反码 = x < 0 ? "1" + mag.split("").map((b) => (b === "0" ? "1" : "0")).join("") : 原码;
      const 补码 = x < 0 ? ((Number.parseInt(反码, 2) + 1) & 0xff).toString(2).padStart(W, "0") : 原码;
      const 移码 = (补码[0] === "1" ? "0" : "1") + 补码.slice(1);
      const toBits = (s: string) => s.split("").map(Number);
      const specs: FrameSpec[] = [
        { type: "SIGN", narration: `${x} 是负数：符号位 1，数值 5 = ${mag}`, views: [{ kind: "bits", label: "原码符号位", groups: [{ label: "S", bits: [1] }] }] },
        { type: "TRUE", narration: "原码：符号位 + 绝对值", views: [{ kind: "bits", label: "原码", groups: [{ label: 原码, bits: toBits(原码), splitAt: 1 }] }] },
        { type: "ONES", narration: "反码：负数符号位不变，其余按位取反", views: [{ kind: "bits", label: "反码", groups: [{ label: 反码, bits: toBits(反码), splitAt: 1 }] }] },
        { type: "TWOS", narration: "补码：反码末位加 1", views: [{ kind: "bits", label: "补码", groups: [{ label: 补码, bits: toBits(补码), splitAt: 1 }] }] },
        { type: "BIAS", narration: "移码：补码符号位取反（常用于阶码）", views: [{ kind: "bits", label: "移码", groups: [{ label: 移码, bits: toBits(移码), splitAt: 1 }] }], metrics: [{ label: "补码", value: 补码 }, { label: "移码", value: 移码 }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 8. 多体交叉存储 */
const interleave: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.memory-interleave", "co", "多体交叉存储器", "地址按体号低位分配，连续访问可并行启动。", "m 体交叉的吞吐约为单体 m 倍",
      [
        { key: "banks", label: "存储体数", type: "select" as const, options: [2, 4, 8].map((v) => ({ value: String(v), label: String(v) })) },
        { key: "words", label: "连续访问字数", type: "select" as const, options: [4, 8, 16].map((v) => ({ value: String(v), label: String(v) })) },
      ]),
    presets: [{ label: "4 体 8 字", patch: { banks: "4", words: "8" } }],
  };
  return {
    ...base,
    defaultInput: { banks: "4", words: "8" },
    simulate(input: any) {
      const m = Number(input.banks), n = Number(input.words);
      const T = 1;
      const total = Math.ceil(n / m) * T + (m - 1) * T;
      const serial = n * T;
      const specs: FrameSpec[] = [
        { type: "SERIAL", narration: `单体存储：${n} 个字要 ${serial} 个周期（一个一个来）`, views: [{ kind: "timeline", label: "单体", span: serial, segments: Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1, label: "W" + i, state: "idle" as const })) }], metrics: [{ label: "单体周期", value: serial }] },
        { type: "BANKS", narration: `${m} 体交叉：字 ${0}..${n - 1} 按体号 = 字地址 mod ${m} 分配到各体`, views: [{ kind: "chips", label: "各体首批字", items: Array.from({ length: m }, (_, b) => ({ text: "W" + b, sub: "体" + b, state: "active" as const })) }] },
        { type: "PIPELINE", narration: `流水启动：第一个周期同时启动 ${m} 个体`, views: [{ kind: "timeline", label: "交叉存取", span: total, segments: Array.from({ length: n }, (_, i) => ({ start: Math.floor(i / m), end: Math.floor(i / m) + 1, label: "W" + i, state: "active" as const })) }], metrics: [{ label: "交叉周期", value: total }] },
        { type: "DONE", narration: `${m} 体交叉用 ${total} 个周期，而单体要 ${serial} 个周期`, views: [{ kind: "bars", label: "总周期对比", max: serial, items: [{ label: "单体", value: serial, state: "bad" }, { label: "交叉", value: total, state: "done" }] }], metrics: [{ label: "加速比", value: (serial / total).toFixed(2) + "×", tone: "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch6 = { bstSearch, floyd, huffman, cyclicQueue, pipelineTiming, missTypes, dataRepr, interleave };