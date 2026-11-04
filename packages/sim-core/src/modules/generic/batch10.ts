import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

/**
 * 第十批：关键路径、稀疏矩阵快速转置、TLB 转换、浮点加减法、
 * 总线带宽、指令微操作序列、进程状态转换。
 */

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

const intIn = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;

// ---------- 1. 关键路径（AOE 网） ----------
const criticalPath: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.critical-path", "ds", "关键路径", { edges: "1,2,3;1,3,2;2,4,4;3,4,2;4,5,3" });
  const FIELDS = [{ key: 'edges', label: '带权边（起点,终点,工期；分号分隔）', type: 'text' as const, placeholder: '1,2,3' }];
  return {
    meta,
    summary: 'AOE 网里工期由关键路径决定，松弛为 0 的活动一步都不能拖。',
    takeaway: '最长路径决定工期；关键活动松弛为 0，一拖就拖整个工程。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { edges: '1,2,3;1,3,2;2,4,4;3,4,2;4,5,3' } },
      { label: '更长的链', patch: { edges: '1,2,4;2,3,3;3,4,2;1,3,5;3,5,2;4,5,4' } },
    ],
    simulate(inp: any) {
      const pairs: [number, number, number][] = String(inp.edges)
        .split(/;|，/)
        .map((t) => t.split(/[,，\s]+/).filter(Boolean).map(Number) as number[])
        .filter((a) => a.length === 3)
        .map((a) => [a[0]!, a[1]!, a[2]!] as [number, number, number]);
      const issues = pairs.length < 2 ? [bad('edges', '至少给 2 条带权边（起点,终点,工期）')] : [];
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const nodes = [...new Set(pairs.flatMap((x) => [x[0], x[1]]))].sort((a, b) => a - b);
        const preds = new Map<number, [number, number][]>();
        const succs = new Map<number, [number, number][]>();
        for (const n of nodes) { preds.set(n, []); succs.set(n, []); }
        for (const [u, v, w] of pairs) { preds.get(v)!.push([u, w]); succs.get(u)!.push([v, w]); }
        const indeg = new Map<number, number>(nodes.map((n) => [n, preds.get(n)!.length]));
        const order: number[] = [];
        const queue = nodes.filter((n) => indeg.get(n) === 0);
        while (queue.length) {
          const n = queue.shift()!;
          order.push(n);
          for (const [v] of succs.get(n)!) {
            indeg.set(v, indeg.get(v)! - 1);
            if (indeg.get(v) === 0) queue.push(v);
          }
        }
        if (order.length !== nodes.length) {
          specs.push({ type: 'INIT', narration: '图中存在环，AOE 网不成立，无法求关键路径', views: [{ kind: 'chips', label: '提示', items: [{ text: '有环', state: 'bad' as const }] }] });
        } else {
          const es = new Map<number, number>(nodes.map((n) => [n, 0]));
          specs.push({
            type: 'INIT',
            narration: 'AOE 网有 ' + nodes.length + ' 个事件、' + pairs.length + ' 个活动',
            views: [{ kind: 'fields', label: '活动（工期）', items: pairs.map(([u, v, w]) => ({ text: String(w), sub: u + '→' + v })) }],
          });
          for (const n of order) {
            const pre = preds.get(n)!;
            if (pre.length) es.set(n, Math.max(...pre.map(([u, w]) => (es.get(u) ?? 0) + w)));
            specs.push({
              type: 'ES',
              narration: '事件 ' + n + ' 的最早发生时间 = ' + es.get(n),
              views: [{ kind: 'fields', label: '各事件最早时间', items: order.map((k) => ({ text: String(es.get(k)), sub: '事件 ' + k, state: k === n ? ('active' as const) : ('idle' as const) })) }],
              metrics: [{ label: '当前事件', value: n }, { label: '最早时间', value: es.get(n)! }],
            });
          }
          const dur = Math.max(...nodes.map((n) => es.get(n)!));
          const ls = new Map<number, number>(nodes.map((n) => [n, dur]));
          for (const n of [...order].reverse()) {
            const s = succs.get(n)!;
            if (s.length) ls.set(n, Math.min(...s.map(([v, w]) => ls.get(v)! - w)));
          }
          const acts = pairs.map(([u, v, w]) => ({ u, v, w, es: es.get(u)!, ls: ls.get(v)! - w }));
          const cp = acts.filter((a) => a.ls - a.es === 0);
          specs.push({
            type: 'LATEST',
            narration: '逆拓扑序求最迟开始时间，工期 = ' + dur,
            views: [{ kind: 'matrix', label: '活动时间表', columns: ['活动', '工期', '最早开始', '最迟开始', '松弛'], rowHeaders: acts.map((a) => a.u + '→' + a.v), rows: acts.map((a) => [a.u + '→' + a.v, a.w, a.es, a.ls, a.ls - a.es]) }],
            metrics: [{ label: '工期', value: dur }],
          });
          specs.push({
            type: 'DONE',
            narration: '关键路径：' + cp.map((a) => a.u + '→' + a.v).join('、') + '（松弛均为 0）',
            views: [{ kind: 'chips', label: '关键活动', items: cp.map((a) => ({ text: a.u + '→' + a.v, sub: '工期 ' + a.w, state: 'done' as const })) }],
            metrics: [{ label: '工期', value: dur }, { label: '关键活动', value: cp.length }, { label: '关键路径长', value: cp.reduce((s2, a) => s2 + a.w, 0) }],
          });
        }
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 2. 稀疏矩阵快速转置 ----------
const sparseTranspose: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.sparse-matrix", "ds", "稀疏矩阵快速转置", { triples: "0,0,3;0,2,5;1,1,2;2,0,1;2,2,4" });
  const FIELDS = [{ key: 'triples', label: '非零元三元组（行,列,值；分号分隔）', type: 'text' as const, placeholder: '0,0,3' }];
  return {
    meta,
    summary: '按列计数再累加定位，转置时间降到 O(列数 + 非零元个数)。',
    takeaway: '先数每列几个非零元，再累加成起点，一次扫描就把元素放对位置。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { triples: '0,0,3;0,2,5;1,1,2;2,0,1;2,2,4' } },
      { label: '更稀疏', patch: { triples: '0,3,1;1,0,2;2,1,3;3,2,4;3,3,5' } },
    ],
    simulate(inp: any) {
      const trip: [number, number, number][] = String(inp.triples)
        .split(/;|，/)
        .map((t) => t.split(/[,，\s]+/).filter(Boolean).map(Number) as number[])
        .filter((a) => a.length === 3)
        .map((a) => [a[0]!, a[1]!, a[2]!] as [number, number, number]);
      const issues = trip.length < 1 ? [bad('triples', '至少一个非零元（行,列,值）')] : [];
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const rows = Math.max(...trip.map((t) => t[0]!)) + 1;
        const cols = Math.max(...trip.map((t) => t[1]!)) + 1;
        const grid = (label: string, rs: number, cs: number, trans: boolean) => ({
          kind: 'grid' as const, label, columns: [...Array(cs).keys()].map((c) => '列' + c),
          rowHeaders: [...Array(rs).keys()].map((r) => '行' + r),
          rows: [...Array(rs).keys()].map((r) => [...Array(cs).keys()].map((c) => {
            const t = trans ? trip.find((x) => x[1] === r && x[0] === c) : trip.find((x) => x[0] === r && x[1] === c);
            return t ? { text: String(t[2]), state: 'done' as const } : { text: '·' };
          })),
        });
        specs.push({ type: 'INIT', narration: '原矩阵 ' + rows + ' 行 ' + cols + ' 列，只有 ' + trip.length + ' 个非零元', views: [grid('原矩阵', rows, cols, false)] });
        const num = new Array<number>(cols).fill(0);
        for (const [, c] of trip) num[c]! += 1;
        const cpot = new Array<number>(cols).fill(0);
        for (let c = 1; c < cols; c++) cpot[c] = cpot[c - 1]! + num[c - 1]!;
        specs.push({
          type: 'CPOT',
          narration: '统计每列非零元个数 num，累加得到每列起点 cpot',
          views: [{ kind: 'fields', label: '定位表', items: [...Array(cols).keys()].map((c) => ({ text: 'num=' + num[c] + '  cpot=' + cpot[c], sub: '列 ' + c })) }],
          metrics: [{ label: '列数', value: cols }, { label: '非零元', value: trip.length }],
        });
        const cursor = [...cpot];
        const placed: [number, number, number][] = new Array<[number, number, number]>(trip.length).fill([0, 0, 0]);
        for (const [r, c, v] of trip) { placed[cursor[c]!] = [c, r, v]; cursor[c]! += 1; }
        specs.push({
          type: 'TRANSPOSE',
          narration: '按行扫描三元组表，用 cpot 一次定位；转置后行列互换',
          views: [{ kind: 'matrix', label: '转置后的三元组（按列主序）', columns: ['行（原列）', '列（原行）', '值'], rowHeaders: placed.map((_, i) => '第 ' + (i + 1) + ' 项'), rows: placed.map(([r, c, v]) => [r, c, v]) }],
          metrics: [{ label: '非零元', value: trip.length }],
        });
        specs.push({
          type: 'DONE',
          narration: '转置矩阵 ' + cols + ' 行 ' + rows + ' 列，全程没有比较和反复移动',
          views: [grid('转置矩阵', cols, rows, true)],
          metrics: [{ label: '转置行数', value: cols }, { label: '非零元', value: trip.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 3. TLB 与地址转换 ----------
const tlb: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.tlb", "co", "TLB 与地址转换", { addr: "2:100", pageSize: "4096" });
  const FIELDS = [
    { key: 'addr', label: '虚拟地址（页号:页内偏移）', type: 'text' as const, placeholder: '2:100' },
    { key: 'pageSize', label: '页大小（字节）', type: 'number' as const, min: 16, max: 65536 },
  ];
  const PAGES = [5, 2, 7, 1];
  const TLB: [number, number][] = [[0, 5], [2, 7]];
  return {
    meta,
    summary: '先查 TLB：命中直接得页框号，缺失才多花一次访存去查页表。',
    takeaway: '页号→查 TLB→页框号→拼物理地址；TLB 命中省掉一次访存。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: 'TLB 命中', patch: { addr: '2:100' } },
      { label: 'TLB 缺失', patch: { addr: '1:2048' } },
      { label: '越界页号', patch: { addr: '9:10' } },
    ],
    simulate(inp: any) {
      const pageSize = Number(inp.pageSize) || 4096;
      const parts = String(inp.addr).split(':');
      const pg = parts.length === 2 ? Number(parts[0]) : NaN;
      const off = parts.length === 2 ? Number(parts[1]) : NaN;
      const issues: any[] = [];
      if (!intIn(pg, 0, PAGES.length - 1)) issues.push(bad('addr', '页号要写 0 到 ' + (PAGES.length - 1) + '，格式是 页号:页内偏移'));
      if (!(off >= 0 && off < pageSize)) issues.push(bad('addr', '页内偏移要写 0 到 ' + (pageSize - 1)));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        specs.push({
          type: 'INIT',
          narration: '虚拟地址 ' + pg + ':' + off + '，页大小 ' + pageSize + ' 字节',
          views: [{ kind: 'fields', label: '地址分解', items: [{ text: String(pg), sub: '页号' }, { text: String(off), sub: '页内偏移' }] }],
        });
        const hit = TLB.find((e) => e[0] === pg);
        specs.push({
          type: 'TLB',
          narration: hit ? 'TLB 命中，直接得到页框号 ' + hit[1] : 'TLB 缺失，要多一次访存查页表',
          views: [{ kind: 'chips', label: 'TLB（页号→页框）', items: TLB.map(([pgn, fr]) => ({ text: pgn + '→' + fr, sub: pgn === pg ? '命中' : '', state: pgn === pg ? ('done' as const) : ('idle' as const) })) }],
          metrics: [{ label: 'TLB命中', value: hit ? 1 : 0 }, { label: '访存次数', value: hit ? 1 : 2 }],
        });
        const frame = hit ? hit[1]! : PAGES[pg]!;
        if (!hit) {
          specs.push({
            type: 'PAGE_TABLE',
            narration: '访问内存中的页表：页 ' + pg + ' → 页框 ' + frame,
            views: [{ kind: 'fields', label: '页表', items: PAGES.map((f, idx) => ({ text: '框 ' + f, sub: '页 ' + idx, state: idx === pg ? ('active' as const) : ('idle' as const) })) }],
            metrics: [{ label: '访存次数', value: 2 }],
          });
        }
        const phys = frame * pageSize + off;
        specs.push({
          type: 'DONE',
          narration: '物理地址 = ' + frame + '×' + pageSize + ' + ' + off + ' = ' + phys,
          views: [{ kind: 'fields', label: '结果', items: [{ text: String(frame), sub: '页框号' }, { text: String(phys), sub: '物理地址', state: 'done' as const }] }],
          metrics: [{ label: '物理地址', value: phys }, { label: '访存次数', value: hit ? 1 : 2 }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 4. 浮点加减法 ----------
const floatAdd: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.float-add", "co", "浮点加减法", { am: "1.5", ae: "3", bm: "2.25", be: "1" });
  const FIELDS = [
    { key: 'am', label: 'A 尾数', type: 'text' as const, placeholder: '1.5' },
    { key: 'ae', label: 'A 阶码', type: 'text' as const, placeholder: '3' },
    { key: 'bm', label: 'B 尾数', type: 'text' as const, placeholder: '2.25' },
    { key: 'be', label: 'B 阶码', type: 'text' as const, placeholder: '1' },
  ];
  return {
    meta,
    summary: '对阶 → 尾数相加 → 规格化 → 判溢出，顺序不能颠倒。',
    takeaway: '小阶向大阶对齐，它的尾数右移；结果先规格化再判溢出。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { am: '1.5', ae: '3', bm: '2.25', be: '1' } },
      { label: '同指数', patch: { am: '1.25', ae: '2', bm: '1.75', be: '2' } },
      { label: '需要右规', patch: { am: '1.875', ae: '1', bm: '1.875', be: '1' } },
    ],
    simulate(inp: any) {
      const am = Number(inp.am), ae = Number(inp.ae), bm = Number(inp.bm), be = Number(inp.be);
      const issues: any[] = [];
      if (![am, ae, bm, be].every((x) => Number.isFinite(x))) issues.push(bad('am', '四个数都要填数字，形式是 尾数 × 2^阶码'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const show = (m: number, e: number) => m + '×2^' + e;
        specs.push({
          type: 'INIT',
          narration: 'A = ' + show(am, ae) + '，B = ' + show(bm, be),
          views: [{ kind: 'fields', label: '输入', items: [{ text: String(am), sub: 'A 尾数' }, { text: String(ae), sub: 'A 阶码' }, { text: String(bm), sub: 'B 尾数' }, { text: String(be), sub: 'B 阶码' }] }],
        });
        const hi = Math.max(ae, be);
        const am2 = am / Math.pow(2, hi - ae);
        const bm2 = bm / Math.pow(2, hi - be);
        specs.push({
          type: 'ALIGN',
          narration: '对阶到指数 ' + hi + '：小阶向大阶对齐，它的尾数右移',
          views: [{ kind: 'fields', label: '对阶后', items: [{ text: show(am2, hi), sub: 'A', state: ae < hi ? ('active' as const) : ('idle' as const) }, { text: show(bm2, hi), sub: 'B', state: be < hi ? ('active' as const) : ('idle' as const) }] }],
          metrics: [{ label: '对齐指数', value: hi }, { label: '右移位数', value: Math.abs(ae - be) }],
        });
        const sum = am2 + bm2;
        specs.push({
          type: 'ADD',
          narration: '尾数相加：' + am2 + ' + ' + bm2 + ' = ' + sum,
          views: [{ kind: 'fields', label: '尾数和', items: [{ text: show(sum, hi), sub: '未规格化' }] }],
          metrics: [{ label: '尾数和', value: Number(sum.toFixed(6)) }],
        });
        let m = sum;
        let e = hi;
        let note = '尾数已在 [1,2) 内，无需规格化';
        while (m >= 2) { m /= 2; e += 1; note = '尾数 ≥2，右规：尾数右移 1 位、阶码加 1'; }
        while (m > 0 && m < 1) { m *= 2; e -= 1; note = '尾数 <1，左规：尾数左移、阶码减小'; }
        specs.push({
          type: 'NORMALIZE',
          narration: '规格化：' + note + '，得到 ' + show(m, e),
          views: [{ kind: 'fields', label: '规格化结果', items: [{ text: String(m), sub: '尾数' }, { text: String(e), sub: '阶码' }, { text: note, sub: '说明' }] }],
          metrics: [{ label: '尾数', value: Number(m.toFixed(6)) }, { label: '阶码', value: e }],
        });
        const overflow = e > 127 ? '阶码上溢（溢出）' : e < -126 ? '阶码下溢' : '无溢出';
        specs.push({
          type: 'DONE',
          narration: '最终结果 ' + show(m, e) + '，' + overflow,
          views: [{ kind: 'chips', label: '结论', items: [{ text: show(m, e), sub: overflow, state: overflow === '无溢出' ? ('done' as const) : ('bad' as const) }] }],
          metrics: [{ label: '尾数', value: Number(m.toFixed(6)) }, { label: '阶码', value: e }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 5. 总线带宽 ----------
const busBandwidth: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.bus-bandwidth", "co", "总线带宽计算", { width: "32", clock: "100", cycles: "2" });
  const FIELDS = [
    { key: 'width', label: '数据线位数（位）', type: 'number' as const, min: 1, max: 512 },
    { key: 'clock', label: '时钟频率（MHz）', type: 'number' as const, min: 1, max: 5000 },
    { key: 'cycles', label: '一次传输占几个时钟周期', type: 'number' as const, min: 1, max: 16 },
  ];
  return {
    meta,
    summary: '带宽 = 一次传输的字节数 ÷ 占用周期数 × 时钟频率。',
    takeaway: '位宽、频率、周期数三个因子，动任何一个带宽都跟着变。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { width: '32', clock: '100', cycles: '2' } },
      { label: '64 位 DDR', patch: { width: '64', clock: '200', cycles: '1' } },
      { label: '老 ISA 总线', patch: { width: '16', clock: '8', cycles: '3' } },
    ],
    simulate(inp: any) {
      const width = Number(inp.width), clock = Number(inp.clock), cycles = Number(inp.cycles);
      const issues: any[] = [];
      if (!(width > 0 && clock > 0 && cycles > 0)) issues.push(bad('width', '位宽和频率要大于 0，周期数至少为 1'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const bytes = width / 8;
        const perCycle = bytes / cycles;
        const mbps = perCycle * clock;
        specs.push({
          type: 'INIT',
          narration: '总线宽度 ' + width + ' 位，时钟 ' + clock + ' MHz，一次传输占 ' + cycles + ' 个时钟周期',
          views: [{ kind: 'fields', label: '参数', items: [{ text: width + ' 位', sub: '位宽' }, { text: clock + ' MHz', sub: '时钟频率' }, { text: String(cycles), sub: '传输周期' }] }],
        });
        specs.push({
          type: 'BYTES',
          narration: '一次并行传输 ' + width + ' 位 = ' + bytes + ' 字节，平均每个时钟 ' + perCycle + ' 字节',
          views: [{ kind: 'fields', label: '一次传输', items: [{ text: String(bytes), sub: '每传字节数' }, { text: String(perCycle), sub: '每时钟字节' }] }],
          metrics: [{ label: '一次传输字节', value: bytes }],
        });
        specs.push({
          type: 'BANDWIDTH',
          narration: '带宽 = ' + bytes + ' ÷ ' + cycles + ' × ' + clock + ' = ' + mbps + ' MB/s',
          views: [{ kind: 'fields', label: '带宽', items: [{ text: mbps + ' MB/s', sub: '带宽', state: 'done' as const }, { text: (mbps / 1024).toFixed(2) + ' GB/s', sub: '折算' }] }],
          metrics: [{ label: '带宽MB每秒', value: mbps }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 6. 指令的微操作序列 ----------
const microop: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.microop", "co", "指令的微操作序列", { instr: "add" });
  const FIELDS = [{ key: 'instr', label: '指令', type: 'select' as const, options: [{ value: 'add', label: 'ADD 加法' }, { value: 'load', label: 'LOAD 取数' }, { value: 'store', label: 'STORE 存数' }] }];
  const PLAN: Record<string, [string, string][]> = {
    add: [['T0', 'PC→MAR，(PC)+1→PC'], ['T1', 'MAR→地址总线，指令→MDR'], ['T2', 'MDR→IR，指令译码'], ['T3', 'IR 地址码→MAR，取第一操作数→ACC'], ['T4', 'ACC 与第二操作数相加→ACC'], ['T5', '置条件码（Z/C/V），指令结束']],
    load: [['T0', 'PC→MAR，(PC)+1→PC'], ['T1', 'MAR→地址总线，指令→MDR'], ['T2', 'MDR→IR，指令译码'], ['T3', 'IR 地址码→MAR'], ['T4', 'MAR→地址总线，数据→MDR'], ['T5', 'MDR→ACC，指令结束']],
    store: [['T0', 'PC→MAR，(PC)+1→PC'], ['T1', 'MAR→地址总线，指令→MDR'], ['T2', 'MDR→IR，指令译码'], ['T3', 'IR 地址码→MAR'], ['T4', 'ACC→MDR'], ['T5', 'MDR→存储器，指令结束']],
  };
  return {
    meta,
    summary: '取指周期每条指令都一样，执行周期按指令分叉，每步对应一组控制信号。',
    takeaway: '同一台机器取指周期相同，差别都在执行周期的微操作。',
    fields: FIELDS,
    defaultInput: input,
    presets: [{ label: 'ADD 加法', patch: { instr: 'add' } }, { label: 'LOAD 取数', patch: { instr: 'load' } }, { label: 'STORE 存数', patch: { instr: 'store' } }],
    simulate(inp: any) {
      const instr = String(inp.instr);
      const plan = PLAN[instr];
      const issues = plan ? [] : [bad('instr', '可选：add / load / store')];
      const specs: FrameSpec[] = [];
      if (plan) {
        specs.push({ type: 'INIT', narration: '执行一条 ' + instr.toUpperCase() + ' 指令，前 3 步是公共取指周期', views: [{ kind: 'chips', label: '当前指令', items: [{ text: instr.toUpperCase(), state: 'done' as const }] }] });
        plan.forEach((step, i) => {
          const phase = i < 3 ? '取指周期' : '执行周期';
          specs.push({
            type: 'MICRO',
            narration: step[0] + '（' + phase + '）：' + step[1],
            views: [
              { kind: 'timeline', label: '微操作序列', span: plan.length, segments: plan.map((s2, j) => ({ start: j, end: j + 1, label: s2[0], state: j < i ? ('done' as const) : j === i ? ('active' as const) : ('idle' as const) })) },
              { kind: 'fields', label: '本步控制信号', items: [{ text: step[1], sub: step[0] + ' ' + phase }] },
            ],
            metrics: [{ label: '第几步', value: i + 1 }, { label: '总步数', value: plan.length }],
          });
        });
        specs.push({
          type: 'DONE',
          narration: plan.length + ' 个微操作走完一个指令周期；若此时有中断请求，还要进中断周期',
          views: [{ kind: 'timeline', label: '完整微操作序列', span: plan.length, segments: plan.map((s2, j) => ({ start: j, end: j + 1, label: s2[0], state: 'done' as const })) }],
          metrics: [{ label: '微操作数', value: plan.length }, { label: '时钟数', value: plan.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 7. 进程状态转换 ----------
const processState: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.process-state", "os", "进程状态转换", { events: "create,ready,run,block,run,terminate" });
  const FIELDS = [{ key: 'events', label: '事件序列（逗号分隔）', type: 'text' as const, placeholder: 'create,ready,run,block' }];
  const MEANING: Record<string, string> = {
    create: '创建 → 就绪', ready: '被调度：就绪 → 运行', run: '时间片用完：运行 → 就绪',
    block: '等待 I/O：运行 → 阻塞', suspend: '挂起：阻塞 → 静止阻塞', resume: '激活：静止阻塞 → 阻塞', terminate: '结束：运行 → 终止',
  };
  const AFTER: Record<string, string> = { create: '就绪', ready: '运行', run: '就绪', block: '阻塞', suspend: '静止阻塞', resume: '阻塞', terminate: '终止' };
  return {
    meta,
    summary: '五状态模型：创建→就绪→运行→阻塞→终止，挂起把阻塞态换出到静止阻塞。',
    takeaway: '转换不能随便跳：只有运行态能阻塞，阻塞态要先回就绪才能再运行。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '完整一生', patch: { events: 'create,ready,run,block,run,terminate' } },
      { label: '被抢占', patch: { events: 'create,ready,run,ready,run,terminate' } },
      { label: '含挂起激活', patch: { events: 'create,ready,run,block,suspend,resume,run,terminate' } },
    ],
    simulate(inp: any) {
      const evs = String(inp.events).toLowerCase().split(/[,，\s]+/).filter(Boolean);
      const unknown = evs.filter((e) => !MEANING[e]);
      let issues: any[] = [];
      if (evs.length < 1) issues = [bad('events', '至少一个事件：create/ready/run/block/suspend/resume/terminate')];
      else if (unknown.length) issues = [bad('events', '不认识的事件：' + unknown.join('、'))];
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        specs.push({ type: 'INIT', narration: '初始：进程还不存在，共 ' + evs.length + ' 个事件', views: [{ kind: 'chips', label: '五状态', items: ['未创建', '就绪', '运行', '阻塞', '终止'].map((x, i2) => ({ text: x, state: i2 === 0 ? ('active' as const) : ('idle' as const) })) }] });
        evs.forEach((e, i) => {
          specs.push({
            type: 'STATE',
            narration: (i + 1) + '. ' + e + '：' + (MEANING[e] ?? e) + '，之后处于「' + (AFTER[e] ?? e) + '」',
            views: [{ kind: 'chips', label: '事件序列', items: evs.map((x, j) => ({ text: x, sub: j === i ? (AFTER[x] ?? x) : '', state: j < i ? ('done' as const) : j === i ? ('active' as const) : ('idle' as const) })) }],
            metrics: [{ label: '第几步', value: i + 1 }, { label: '之后状态', value: AFTER[e] ?? e }],
          });
        });
        const last = evs[evs.length - 1]!;
        specs.push({
          type: 'DONE',
          narration: '走完 ' + evs.length + ' 次转换，进程最终处于「' + (AFTER[last] ?? last) + '」',
          views: [{ kind: 'timeline', label: '状态时间线', span: evs.length, segments: evs.map((x, i) => ({ start: i, end: i + 1, label: AFTER[x] ?? x, state: 'done' as const })) }],
          metrics: [{ label: '事件数', value: evs.length }, { label: '最终状态', value: AFTER[last] ?? last }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

export const batch10 = { criticalPath, sparseTranspose, tlb, floatAdd, busBandwidth, microop, processState } as const;
