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

/* 1. B 树插入分裂 */
const bTree: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.b-tree", "ds", "B 树的插入与分裂", "结点满了就中间关键字上移，树向上生长。", "分裂让所有叶子保持同一层",
      [{ key: "keys", label: "插入序列", type: "text" as const }]),
    presets: [
      { label: "触发一次分裂", patch: { keys: "10,20,30,40" } },
      { label: "连续分裂", patch: { keys: "10,20,30,40,50,60,70" } },
    ],
  };
  return {
    ...base,
    defaultInput: { keys: "10,20,30,40" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const seq = String(input.keys).split(/[,\s]+/).filter(Boolean).map(Number);
      if (seq.length < 2 || seq.length > 8 || seq.some((x) => !Number.isInteger(x))) issues.push(bad("keys", "需要 2–8 个整数"));
      const MAX = 3; // 4 阶：最多 3 个关键字
      let nodes: number[][] = [[]];
      const specs: FrameSpec[] = [];
      const view = (hot: number) => ({
        kind: "chips" as const,
        label: "各结点关键字（叶子同层）",
        items: nodes.flatMap((n, i) => n.map((k) => ({ text: String(k), sub: "N" + i, state: k === hot ? "active" as const : "done" as const }))),
      });
      specs.push({ type: "INIT", narration: "空树：只有一个空的根结点", views: [view(-1)] });
      for (const k of seq) {
        nodes[0]!.push(k);
        nodes[0]!.sort((a, b) => a - b);
        specs.push({ type: "INSERT", narration: `插入 ${k}：根结点关键字 ${nodes[0]!.join(", ")}`, views: [view(k)] });
        let guard = 0;
        while (nodes[0]!.length > MAX && guard < 5) {
          guard++;
          const all = nodes[0]!;
          const mid = Math.floor(all.length / 2);
          const midKey = all[mid]!;
          nodes = [[midKey], all.slice(0, mid), all.slice(mid + 1)];
          specs.push({ type: "SPLIT", narration: `结点超过 ${MAX} 个关键字 → 中间关键字 ${midKey} 上移，分裂成两个子结点`, views: [view(midKey)], metrics: [{ label: "关键字总数", value: seq.indexOf(k) + 1 }] });
        }
      }
      specs.push({ type: "DONE", narration: `插入完成：根 ${nodes[0]!.join(", ")}`, views: [view(-1)], metrics: [{ label: "根关键字", value: nodes[0]!.length }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 2. 基数排序 */
const radixSort: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.radix-sort", "ds", "基数排序", "按个位、十位、百位依次分配与收集，每轮都是稳定排序。", "位数决定轮数，每轮 O(n)",
      [{ key: "nums", label: "待排序整数", type: "text" as const }]),
    presets: [{ label: "三位数", patch: { nums: "329, 457, 657, 839, 436, 720, 355" } }, { label: "个位不同", patch: { nums: "12, 5, 88, 31" } }],
  };
  return {
    ...base,
    defaultInput: { nums: "329, 457, 657, 839, 436, 720, 355" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const nums = String(input.nums).split(/[,\s]+/).filter(Boolean).map(Number);
      if (nums.length < 2 || nums.length > 10 || nums.some((n) => !Number.isInteger(n) || n < 0)) issues.push(bad("nums", "需要 2–10 个非负整数"));
      const digits = Math.max(...nums.map((n) => String(n).length));
      let arr = [...nums];
      const specs: FrameSpec[] = [{ type: "INIT", narration: `${nums.length} 个数，最多 ${digits} 位 → ${digits} 轮`, views: [{ kind: "chips", label: "初始序列", items: arr.map((n) => ({ text: String(n) })) }] }];
      for (let d = 0; d < digits; d++) {
        const buckets: number[][] = Array.from({ length: 10 }, () => []);
        for (const n of arr) {
          const digit = Math.floor(n / Math.pow(10, d)) % 10;
          buckets[digit]!.push(n);
        }
        specs.push({
          type: "DISTRIBUTE",
          narration: `按${["个", "十", "百", "千"][d] ?? "更高"}位分配到 0–9 号桶`,
          views: [{ kind: "grid", label: "桶", columns: Array.from({ length: 10 }, (_, i) => String(i)), rows: [buckets.map((b) => ({ text: b.join(" ") || "·", state: b.length ? ("active" as const) : ("idle" as const) }))] }],
        });
        arr = buckets.flat();
        specs.push({ type: "COLLECT", narration: `按桶序收集：${arr.join(", ")}`, views: [{ kind: "chips", label: `第 ${d + 1} 轮结果`, items: arr.map((n) => ({ text: String(n), state: "done" as const })) }], metrics: [{ label: "轮次", value: d + 1 }] });
      }
      specs.push({ type: "DONE", narration: `排序完成：${arr.join(", ")}`, views: [{ kind: "chips", label: "最终序列", items: arr.map((n) => ({ text: String(n), state: "done" as const })) }], metrics: [{ label: "最小值", value: arr[0]! }, { label: "最大值", value: arr[arr.length - 1]! }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 3. 拉链法 */
const hashChain: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.hash-chain", "ds", "哈希表：拉链法", "冲突不占别的槽位，而是挂在同一条链上。", "链长决定查找代价",
      [
        { key: "keys", label: "插入的键", type: "text" as const },
        { key: "size", label: "桶数", type: "select" as const, options: [5, 7].map((v) => ({ value: String(v), label: String(v) })) },
      ]),
    presets: [{ label: "制造冲突", patch: { keys: "12, 19, 26, 33, 5", size: "7" } }],
  };
  return {
    ...base,
    defaultInput: { keys: "12, 19, 26, 33, 5", size: "7" },
    simulate(input: any) {
      const m = Number(input.size);
      const keys = String(input.keys).split(/[,\s]+/).filter(Boolean).map(Number);
      const issues: Issue[] = [];
      if (keys.length < 2 || keys.length > 12) issues.push(bad("keys", "键数量 2–12"));
      const buckets: number[][] = Array.from({ length: m }, () => []);
      const specs: FrameSpec[] = [];
      const view = (hot: number) => ({ kind: "chips" as const, label: "bucket → 链表", items: buckets.map((b, i) => ({ text: b.length ? b.join("→") : "空", sub: "[" + i + "]", state: i === hot ? "active" as const : b.length ? "done" as const : "idle" as const })) });
      specs.push({ type: "INIT", narration: `${m} 个桶，初始全空`, views: [view(-1)] });
      let maxChain = 0;
      for (const k of keys) {
        const i = k % m;
        buckets[i]!.push(k);
        maxChain = Math.max(maxChain, buckets[i]!.length);
        specs.push({ type: "INSERT", narration: `${k} mod ${m} = ${i} → ${buckets[i]!.length > 1 ? "冲突，挂到链尾" : "放入空桶"}`, views: [view(i)], metrics: [{ label: "最长链", value: maxChain }] });
      }
      specs.push({ type: "DONE", narration: `装载因子 α = ${keys.length}/${m} ≈ ${(keys.length / m).toFixed(2)}，最长链 ${maxChain}`, views: [view(-1)], metrics: [{ label: "最长链", value: maxChain }, { label: "装填因子", value: (keys.length / m).toFixed(2) }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 4. AVL 旋转 */
const avl: GenericModuleDef<any> = (() => {
  const base = {
    ...M("ds.avl-rotation", "ds", "AVL 树的四种旋转", "插入后不平衡就旋转：LL/RR 单旋，LR/RL 双旋。", "旋转只调整局部，高度 O(logn)",
      [{ key: "seq", label: "插入序列", type: "text" as const }]),
    presets: [{ label: "LL（右旋）", patch: { seq: "30, 20, 10" } }, { label: "LR（先左后右）", patch: { seq: "30, 10, 20" } }, { label: "RR（左旋）", patch: { seq: "10, 20, 30" } }],
  };
  return {
    ...base,
    defaultInput: { seq: "30, 10, 20" },
    simulate(input: any) {
      const seq = String(input.seq).split(/[,\s]+/).filter(Boolean).map(Number);
      const issues: Issue[] = [];
      if (seq.length < 2 || seq.length > 5) issues.push(bad("seq", "插入 2–5 个数"));
      let tree: any = null;
      const h = (n: any): number => (n ? 1 + Math.max(h(n.l), h(n.r)) : 0);
      const rot = (n: any, type: string) => {
        if (type === "LL") { const l = n.l; n.l = l.r; l.r = n; return l; }
        if (type === "RR") { const r = n.r; n.r = r.l; r.l = n; return r; }
        if (type === "LR") { n.l = rot(n.l, "RR"); return rot(n, "LL"); }
        n.r = rot(n.r, "LL"); return rot(n, "RR");
      };
      const insert = (n: any, v: number): { node: any; spin?: string } => {
        if (!n) return { node: { v, l: null, r: null } };
        const child = v < n.v ? insert(n.l, v) : insert(n.r, v);
        if (v < n.v) n.l = child.node; else n.r = child.node;
        const bf = h(n.l) - h(n.r);
        if (bf > 1) {
          const type = h(n.l.l) >= h(n.l.r) ? "LL" : "LR";
          return { node: rot(n, type), spin: type + (type === "LL" ? "（右旋）" : "（先左后右）") };
        }
        if (bf < -1) {
          const type = h(n.r.r) >= h(n.r.l) ? "RR" : "RL";
          return { node: rot(n, type), spin: type + (type === "RR" ? "（左旋）" : "（先右后左）") };
        }
        return { node: n, spin: child.spin };
      };
      const specs: FrameSpec[] = [];
      const levelView = (label: string) => {
        const levels: number[][] = [];
        const walk = (n: any, d: number) => { if (!n) return; (levels[d] ??= []).push(n.v); walk(n.l, d + 1); walk(n.r, d + 1); };
        walk(tree, 0);
        return { kind: "grid" as const, label, columns: ["层 1", "层 2", "层 3"], rows: [0, 1, 2].map((r) => [0, 1, 2].map((c) => levels[r]?.[c] !== undefined ? { text: String(levels[r]![c]), state: "done" as const } : { text: "" })) };
      };
      specs.push({ type: "INIT", narration: "空树，开始插入", views: [levelView("空树")] });
      for (const v of seq) {
        const res = insert(tree, v);
        tree = res.node;
        specs.push({ type: "INSERT", narration: `插入 ${v}${res.spin ? " → 失衡，执行 " + res.spin : "，仍平衡"}`, views: [levelView("插入后")], metrics: [{ label: "树高", value: h(tree) }] });
      }
      specs.push({ type: "DONE", narration: `最终根结点 ${tree?.v}，树高 ${h(tree)}`, views: [levelView("最终形态")], metrics: [{ label: "根", value: tree?.v ?? "-" }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 5. 流水线冒险 */
const hazard: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.pipeline-hazard", "co", "流水线冒险与气泡", "数据相关要停顿，控制相关要清空，结构相关要排队。", "load-use 至少要停 1 个周期",
      [{ key: "kind", label: "冒险类型", type: "select" as const, options: [{ value: "load", label: "load-use 数据冒险" }, { value: "control", label: "分支控制冒险" }, { value: "struct", label: "结构冒险" }] }]),
    presets: [{ label: "load-use", patch: { kind: "load" } }, { label: "分支", patch: { kind: "control" } }],
  };
  return {
    ...base,
    defaultInput: { kind: "load" },
    simulate(input: any) {
      const k = input.kind;
      const stalls = k === "load" ? 1 : k === "control" ? 2 : 1;
      const base0 = 9;
      const total = base0 + stalls;
      const specs: FrameSpec[] = [
        { type: "DETECT", narration: k === "load" ? "后一条指令要用 load 刚取回的数据 → 数据冒险" : k === "control" ? "分支指令还没决定方向 → 控制冒险" : "两条指令同时要用同一个部件 → 结构冒险", views: [{ kind: "timeline", label: "流水线", span: total, segments: [{ start: 0, end: 4, label: "正常推进", state: "done" }] }] },
        { type: "STALL", narration: `插入 ${stalls} 个气泡（停顿 ${stalls} 个周期）`, views: [{ kind: "timeline", label: "流水线", span: total, segments: [{ start: 0, end: 4, label: "正常", state: "done" }, { start: 4, end: 4 + stalls, label: "气泡", state: "bad" }] }], metrics: [{ label: "停顿周期", value: stalls }] },
        { type: "DONE", narration: `总周期从 ${base0} 增加到 ${total}${k === "control" ? "（分支预测失败代价更大）" : ""}`, views: [{ kind: "bars", label: "周期对比", max: total, items: [{ label: "无冒险", value: base0, state: "done" }, { label: "有冒险", value: total, state: "bad" }] }], metrics: [{ label: "总周期", value: total }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 6. 寻址方式 */
const addressing: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.instruction-addressing", "co", "寻址方式与有效地址", "形式地址 + 寄存器内容按不同规则组合，得到有效地址。", "间接寻址要多访存一次",
      [
        { key: "mode", label: "寻址方式", type: "select" as const, options: [{ value: "direct", label: "直接寻址" }, { value: "indirect", label: "间接寻址" }, { value: "index", label: "变址寻址" }, { value: "relative", label: "相对寻址" }] },
        { key: "addr", label: "形式地址 A", type: "text" as const },
        { key: "reg", label: "寄存器内容（变址/PC）", type: "text" as const },
      ]),
    presets: [{ label: "变址寻址", patch: { mode: "index", addr: "100", reg: "2000" } }, { label: "相对寻址", patch: { mode: "relative", addr: "-4", reg: "1000" } }],
  };
  return {
    ...base,
    defaultInput: { mode: "index", addr: "100", reg: "2000" },
    simulate(input: any) {
      const A = Number(input.addr), R = Number(input.reg);
      const issues: Issue[] = [];
      if (!Number.isInteger(A) || !Number.isInteger(R)) issues.push(bad("addr", "地址与寄存器内容需为整数"));
      const mode = input.mode;
      const ea = mode === "direct" ? A : mode === "indirect" ? 5000 : mode === "index" ? A + R : R + A;
      const io = mode === "indirect" ? 2 : 1;
      const label = mode === "direct" ? "直接：EA = A" : mode === "indirect" ? "间接：EA = (A)" : mode === "index" ? "变址：EA = A + (R)" : "相对：EA = (PC) + A";
      const specs: FrameSpec[] = [
        { type: "DECODE", narration: `寻址方式：${label}`, views: [{ kind: "fields", items: [{ text: String(A), sub: "形式地址 A" }, { text: String(R), sub: "寄存器/PC", state: "active" }] }] },
        ...(mode === "indirect" ? [{ type: "FETCH_EA", narration: "按 A 访存取出真正的有效地址（第 1 次访存）", views: [{ kind: "timeline", label: "访存次数", span: 3, segments: [{ start: 0, end: 1, label: "取 EA", state: "warn" }] }] }] as FrameSpec[] : []),
        { type: "DONE", narration: `有效地址 EA = ${ea}${mode === "indirect" ? "，再访存一次取操作数" : "，随后访存取操作数"}`, views: [{ kind: "fields", items: [{ text: String(ea), sub: "EA", state: "done" }] }, { kind: "timeline", label: "访存次数", span: 3, segments: Array.from({ length: io }, (_, i) => ({ start: i, end: i + 1, label: i === 0 ? (mode === "indirect" ? "取EA" : "取数") : "取数", state: "active" as const })) }], metrics: [{ label: "EA", value: ea }, { label: "访存", value: io }] },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 7. 总线时序 */
const busTiming: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.bus-timing", "co", "同步 / 异步 / 半同步总线", "同步靠统一时钟，异步靠握手，半同步折中。", "异步最灵活但握手开销大",
      [{ key: "mode", label: "总线类型", type: "select" as const, options: [{ value: "sync", label: "同步总线" }, { value: "async", label: "异步（握手）" }, { value: "semi", label: "半同步" }] }]),
    presets: [{ label: "同步", patch: { mode: "sync" } }, { label: "异步", patch: { mode: "async" } }],
  };
  return {
    ...base,
    defaultInput: { mode: "async" },
    simulate(input: any) {
      const m = input.mode;
      const span = m === "sync" ? 3 : m === "async" ? 5 : 4;
      const label = m === "sync" ? "统一时钟，主从设备按节拍传输" : m === "async" ? "请求-应答握手，慢设备可以拉长周期" : "时钟 + 握手，兼顾速度与兼容";
      const specs: FrameSpec[] = [
        { type: "MODE", narration: label, views: [{ kind: "timeline", label: "总线事务", span, segments: m === "async" ? [{ start: 0, end: 1, label: "请求", state: "active" }, { start: 1, end: 2, label: "等待", state: "warn" }, { start: 2, end: 3, label: "数据", state: "active" }, { start: 3, end: 4, label: "应答", state: "done" }] : [{ start: 0, end: 1, label: "地址", state: "active" }, { start: 1, end: 2, label: "数据", state: "active" }, { start: 2, end: 3, label: "完成", state: "done" }] }] },
        { type: "DONE", narration: m === "async" ? "握手线多、时序灵活，适合不同速度的设备" : m === "sync" ? "时序简单、速度快，但必须迁就最慢设备" : "半同步 = 时钟同步 + 就绪握手", views: [{ kind: "fields", items: [{ text: String(span), sub: "周期数" }, { text: m === "async" ? "多" : "少", sub: "控制线" }, { text: m === "async" ? "高" : "中", sub: "灵活性" }] }], metrics: [{ label: "事务周期", value: span }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 8. CPI 与加速比 */
const cpi: GenericModuleDef<any> = (() => {
  const base = {
    ...M("co.cpi", "co", "CPI 与加速比", "不同指令比例决定平均 CPI，优化热点才有收益。", "Amdahl：加速受限于未优化部分",
      [{ key: "mix", label: "指令混合", type: "select" as const, options: [{ value: "a", label: "运算密集型" }, { value: "b", label: "访存密集型" }] }]),
    presets: [{ label: "运算密集", patch: { mix: "a" } }, { label: "访存密集", patch: { mix: "b" } }],
  };
  return {
    ...base,
    defaultInput: { mix: "a" },
    simulate(input: any) {
      const mix = input.mix === "a" ? [{ n: "ALU", p: 0.5, c: 1 }, { n: "Load", p: 0.3, c: 2 }, { n: "Store", p: 0.1, c: 2 }, { n: "Branch", p: 0.1, c: 3 }]
        : [{ n: "ALU", p: 0.2, c: 1 }, { n: "Load", p: 0.45, c: 2 }, { n: "Store", p: 0.2, c: 2 }, { n: "Branch", p: 0.15, c: 3 }];
      const cpiValue = mix.reduce((s, x) => s + x.p * x.c, 0);
      const speedup = cpiValue / (cpiValue - 0.05 * 1); // 假设 ALU 提速后 CPI 略降
      const specs: FrameSpec[] = [
        { type: "MIX", narration: `指令比例：${mix.map((x) => `${x.n} ${(x.p * 100).toFixed(0)}%`).join("、")}`, views: [{ kind: "chips", label: "指令比例", items: mix.map((x) => ({ text: (x.p * 100).toFixed(0) + "%", sub: x.n, state: "active" as const })) }] },
        { type: "CPI", narration: `CPI = Σ(比例 × 周期数) = ${cpiValue.toFixed(2)}`, views: [{ kind: "bars", label: "各类指令的周期贡献", max: 2, items: mix.map((x) => ({ label: x.n, value: Number((x.p * x.c).toFixed(2)), state: "done" as const })) }], metrics: [{ label: "CPI", value: cpiValue.toFixed(2) }] },
        { type: "AMDAHL", narration: `若把某类指令提速 20 倍，整机加速比约 ${speedup.toFixed(2)}×（未优化部分决定上限）`, views: [{ kind: "fields", items: [{ text: cpiValue.toFixed(2), sub: "原始 CPI" }, { text: speedup.toFixed(2) + "×", sub: "加速比", state: "active" }] }], metrics: [{ label: "加速比", value: speedup.toFixed(2) + "×" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch8 = { bTree, radixSort, hashChain, avl, hazard, addressing, busTiming, cpi };