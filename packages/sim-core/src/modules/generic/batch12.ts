import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

/**
 * 第十二批：Prim 最小生成树、归并排序、中缀转后缀、图的存储结构、
 * ALU 标志位、存储器扩展、流水线吞吐率/加速比/效率。
 */

// ---------- 1. Prim 最小生成树 ----------
const prim: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.prim-mst", "ds", "Prim 最小生成树", { matrix: "0,6,1,5;6,0,5,0;1,5,0,5;5,0,5,0", start: "0" });
  const FIELDS = [
    { key: 'matrix', label: '邻接矩阵（行用分号分隔，0 表示不相连）', type: 'text' as const, placeholder: '0,6,1;6,0,5;1,5,0' },
    { key: 'start', label: '起点顶点', type: 'number' as const, min: 0, max: 7 },
  ];
  return {
    meta,
    summary: '从起点出发，每次挑「树内到树外」权值最小的边扩张。',
    takeaway: 'Prim 看顶点：每步只关心割的最小横切边，稠密图比 Kruskal 划算。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { matrix: '0,6,1,5;6,0,5,0;1,5,0,5;5,0,5,0', start: '0' } },
      { label: '五点环', patch: { matrix: '0,2,0,0,4;2,0,3,0,0;0,3,0,1,0;0,0,1,0,5;4,0,0,5,0', start: '0' } },
    ],
    simulate(inp: any) {
      const rows = String(inp.matrix).split(/[;，]/).map((r) => r.split(/[,，\s]+/).filter(Boolean).map(Number));
      const n = rows.length;
      const issues: any[] = [];
      if (n < 2 || rows.some((r) => r.length !== n)) issues.push(bad('matrix', '邻接矩阵要写成 n 行 n 列'));
      const start = Number(inp.start);
      if (Number.isInteger(start) && start >= 0 && start < n) {
      } else issues.push(bad('start', '起点要在 0 到 ' + (n - 1) + ' 之间'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const grid = {
          kind: 'grid' as const, label: '邻接矩阵', columns: rows.map((_, c) => String(c)), rowHeaders: rows.map((_, r) => 'v' + r),
          rows: rows.map((r, ri) => r.map((v, ci) => ({ text: v ? String(v) : '·', state: ri === start ? ('active' as const) : ('idle' as const) }))),
        };
        specs.push({ type: 'INIT', narration: '从顶点 ' + start + ' 开始，' + n + ' 个顶点', views: [grid] });
        const inTree = new Array<boolean>(n).fill(false);
        inTree[start] = true;
        const chosen: [number, number, number][] = [];
        let total = 0;
        for (let step = 1; step < n; step++) {
          let best: [number, number, number] | null = null;
          for (let u = 0; u < n; u++) {
            if (!inTree[u]) continue;
            for (let v = 0; v < n; v++) {
              if (inTree[v] || !rows[u]?.[v]) continue;
              const w = rows[u]![v]!;
              if (!best || w < best[2]) best = [u, v, w];
            }
          }
          if (!best) { specs.push({ type: 'DONE', narration: '第 ' + step + ' 步找不到横切边：图不连通，生成树不存在', views: [{ kind: 'chips', label: '提示', items: [{ text: '不连通', state: 'bad' as const }] }], metrics: [{ label: '已选边', value: chosen.length }] }); break; }
          inTree[best[1]] = true;
          chosen.push(best);
          total += best[2];
          specs.push({
            type: 'EDGE',
            narration: '第 ' + step + ' 步：树内到树外最小边 ' + best[0] + '–' + best[1] + '（权 ' + best[2] + '）',
            views: [
              { kind: 'grid' as const, label: '顶点归属（●=已在树内）', columns: rows.map((_, c) => String(c)), rowHeaders: ['状态'], rows: [rows.map((_, c) => ({ text: inTree[c] ? '●' : '○', state: c === best![1] ? ('done' as const) : inTree[c] ? ('active' as const) : ('idle' as const) }))] },
              { kind: 'chips', label: '已选边', items: chosen.map(([a, b, w]) => ({ text: a + '–' + b, sub: '权 ' + w, state: 'done' as const })) },
            ],
            metrics: [{ label: '已选边', value: chosen.length }, { label: '累计权值', value: total }],
          });
        }
        if (chosen.length === n - 1) {
          specs.push({
            type: 'DONE',
            narration: '选满 ' + (n - 1) + ' 条边，最小生成树权值 = ' + total,
            views: [{ kind: 'chips', label: '生成树边集', items: chosen.map(([a, b, w]) => ({ text: a + '–' + b, sub: String(w), state: 'done' as const })) }],
            metrics: [{ label: '边数', value: chosen.length }, { label: '总权值', value: total }],
          });
        }
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 2. 归并排序 ----------
const mergeSort: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.merge-sort", "ds", "归并排序", { values: "8,3,5,1,7,2,6,4" });
  const FIELDS = [{ key: 'values', label: '待排序序列（逗号分隔）', type: 'text' as const, placeholder: '8,3,5,1' }];
  return {
    meta,
    summary: '先拆到单元素，再两两归并；每次归并只比较段首元素。',
    takeaway: '归并是「拆到底再合上来」，比较次数 n·log n，需要 O(n) 辅助空间。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '8 个元素', patch: { values: '8,3,5,1,7,2,6,4' } },
      { label: '近乎有序', patch: { values: '1,3,2,4,6,5,7,8' } },
      { label: '逆序', patch: { values: '8,7,6,5,4,3,2,1' } },
    ],
    simulate(inp: any) {
      const a0 = String(inp.values).split(/[,，\s]+/).filter(Boolean).map(Number);
      const issues = a0.length < 2 ? [bad('values', '至少 2 个数')] : [];
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const chips = (arr: number[], hi: number[]) => arr.map((v, i) => ({ text: String(v), state: hi.includes(i) ? ('active' as const) : ('idle' as const) }));
        specs.push({ type: 'INIT', narration: '初始序列 ' + a0.join(',') + '，长度 ' + a0.length, views: [{ kind: 'chips', label: '原始序列', items: chips(a0, []) }] });
        let comps = 0, moves = 0;
        const work = [...a0];
        const scratch = new Array<number>(work.length);
        const sort = (lo: number, mid: number, hi: number) => {
          for (let i = lo; i <= hi; i++) scratch[i] = work[i]!;
          moves += hi - lo + 1;
          let i = lo, j = mid + 1, k = lo;
          const picked: number[] = [];
          while (i <= mid && j <= hi) {
            comps++;
            if (scratch[i]! <= scratch[j]!) work[k++] = scratch[i++]!;
            else work[k++] = scratch[j++]!;
          }
          while (i <= mid) work[k++] = scratch[i++]!;
          while (j <= hi) work[k++] = scratch[j++]!;
          specs.push({
            type: 'MERGE',
            narration: '归并 [' + lo + ',' + mid + '] 与 [' + (mid + 1) + ',' + hi + ']：' + work.slice(lo, hi + 1).join(','),
            views: [{ kind: 'chips', label: '本轮结束后的序列', items: chips(work, []) }],
            metrics: [{ label: '比较次数', value: comps }, { label: '已排好长度', value: hi - lo + 1 }],
          });
          void picked;
        };
        const pass = (size: number) => {
          for (let lo = 0; lo < work.length; lo += 2 * size) {
            const mid = Math.min(lo + size - 1, work.length - 1);
            const hi = Math.min(lo + 2 * size - 1, work.length - 1);
            if (mid < hi) sort(lo, mid, hi);
          }
        };
        for (let size = 1; size < work.length; size *= 2) {
          specs.push({ type: 'SPLIT', narration: '段长 ' + size + '：把相邻两个有序段两两归并', views: [{ kind: 'chips', label: '当前段划分', items: work.map((v, i) => ({ text: String(v), state: Math.floor(i / (2 * size)) % 2 === 0 ? ('done' as const) : ('idle' as const) })) }], metrics: [{ label: '段长', value: size }] });
          pass(size);
        }
        specs.push({
          type: 'DONE',
          narration: '排序完成：' + work.join(',') + '，共比较 ' + comps + ' 次',
          views: [{ kind: 'chips', label: '最终序列', items: chips(work, []) }],
          metrics: [{ label: '比较次数', value: comps }, { label: '元素数', value: work.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 3. 中缀转后缀并求值 ----------
const postfix: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.postfix-eval", "ds", "中缀转后缀求值", { expr: "a+b*(c-d)-e/f" });
  const FIELDS = [{ key: 'expr', label: '中缀表达式（字母变量 + - * / 与括号）', type: 'text' as const, placeholder: 'a+b*(c-d)' }];
  const VAL: Record<string, number> = { a: 2, b: 3, c: 8, d: 2, e: 10, f: 5 };
  return {
    meta,
    summary: '操作符压栈：优先级高或遇右括号才弹出，字母直接输出。',
    takeaway: '后缀式没有括号；求值时遇到操作符就弹两个数——先弹出的是右操作数。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { expr: 'a+b*(c-d)-e/f' } },
      { label: '纯左括号嵌套', patch: { expr: '(a+b)*(c-d)' } },
      { label: '只有乘除', patch: { expr: 'a*b/c' } },
    ],
    simulate(inp: any) {
      const expr = String(inp.expr).replace(/\s+/g, '');
      const issues: any[] = [];
      const toks = expr.match(/[a-f+\-*/()]/g) ?? [];
      if (toks.join('') !== expr) issues.push(bad('expr', '只支持 a–f、+ - * / 和括号'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const prec = (c: string) => (c === '+' || c === '-' ? 1 : c === '*' || c === '/' ? 2 : 0);
        const out: string[] = [];
        const stack: string[] = [];
        specs.push({ type: 'INIT', narration: '中缀：' + expr + '（变量值 ' + Object.keys(VAL).map((k) => k + '=' + VAL[k]).join(', ') + '）', views: [{ kind: 'chips', label: '输入串', items: toks.map((t) => ({ text: t, state: 'idle' as const })) }] });
        toks.forEach((t, i) => {
          if (/[a-f]/.test(t)) {
            out.push(t);
            specs.push({ type: 'OUT', narration: '第 ' + (i + 1) + ' 个符号 ' + t + '：操作数直接输出', views: [{ kind: 'chips', label: '后缀输出', items: out.map((x) => ({ text: x, state: 'done' as const })) }, { kind: 'chips', label: '操作符栈', items: stack.map((x) => ({ text: x, state: 'active' as const })) }], metrics: [{ label: '输出长度', value: out.length }] });
          } else if (t === '(') {
            stack.push(t);
            specs.push({ type: 'PUSH', narration: '第 ' + (i + 1) + ' 个符号 (：直接入栈', views: [{ kind: 'chips', label: '后缀输出', items: out.map((x) => ({ text: x, state: 'done' as const })) }, { kind: 'chips', label: '操作符栈', items: stack.map((x) => ({ text: x, state: 'active' as const })) }] });
          } else if (t === ')') {
            while (stack.length && stack[stack.length - 1] !== '(') out.push(stack.pop()!);
            if (stack.length) stack.pop();
            specs.push({ type: 'POP', narration: '第 ' + (i + 1) + ' 个符号 )：弹出到左括号为止', views: [{ kind: 'chips', label: '后缀输出', items: out.map((x) => ({ text: x, state: 'done' as const })) }, { kind: 'chips', label: '操作符栈', items: stack.map((x) => ({ text: x, state: 'active' as const })) }] });
          } else {
            while (stack.length && prec(stack[stack.length - 1]!) >= prec(t)) out.push(stack.pop()!);
            stack.push(t);
            specs.push({ type: 'OP', narration: '第 ' + (i + 1) + ' 个符号 ' + t + '：弹出栈里优先级不低于它的，再入栈', views: [{ kind: 'chips', label: '后缀输出', items: out.map((x) => ({ text: x, state: 'done' as const })) }, { kind: 'chips', label: '操作符栈', items: stack.map((x) => ({ text: x, state: 'active' as const })) }] });
          }
        });
        while (stack.length) {
          const t = stack.pop()!;
          if (t === '(') { issues.push(bad('expr', '括号不匹配：左括号多余')); break; }
          out.push(t);
        }
        if (!issues.some((i) => i.severity === 'error')) {
          specs.push({ type: 'CONVERT', narration: '后缀式：' + out.join(''), views: [{ kind: 'chips', label: '后缀表达式', items: out.map((x) => ({ text: x, state: 'done' as const })) }] });
          const st: number[] = [];
          let err = '';
          for (const t of out) {
            if (/[a-f]/.test(t)) st.push(VAL[t]!);
            else {
              const r = st.pop(), l = st.pop();
              if (l === undefined || r === undefined) { err = '表达式不合法'; break; }
              st.push(t === '+' ? l + r : t === '-' ? l - r : t === '*' ? l * r : l / r);
            }
            specs.push({
              type: 'EVAL',
              narration: '扫描 ' + t + '：' + (/[a-f]/.test(t) ? '把 ' + t + '=' + VAL[t] + ' 压栈' : '弹出两个数做 ' + t),
              views: [{ kind: 'chips', label: '求值栈', items: st.map((x) => ({ text: String(x), state: 'active' as const })) }],
              metrics: [{ label: '栈大小', value: st.length }],
            });
          }
          specs.push({
            type: 'DONE',
            narration: err ? err : '结果 = ' + st[0],
            views: [{ kind: 'chips', label: '最终', items: [{ text: err || String(st[0]), state: err ? ('bad' as const) : ('done' as const) }] }],
            metrics: err ? [] : [{ label: '结果', value: st[0]! }],
          });
        }
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 4. 图的存储结构对比 ----------
const graphStorage: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.graph-storage", "ds", "图的存储结构", { edges: "0-1,0-2,1-2,1-3,2-3", directed: "no", n: "4" });
  const FIELDS = [
    { key: 'edges', label: '边（a-b，逗号分隔）', type: 'text' as const, placeholder: '0-1,1-2' },
    { key: 'directed', label: '是否有向', type: 'select' as const, options: [{ value: 'no', label: '无向图' }, { value: 'yes', label: '有向图' }] },
    { key: 'n', label: '顶点数', type: 'number' as const, min: 2, max: 8 },
  ];
  return {
    meta,
    summary: '邻接矩阵 O(1) 判边但费空间；邻接表省空间，判边要扫链表。',
    takeaway: '稠密图用邻接矩阵，稀疏图用邻接表；有向图还可能要逆邻接表。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '稀疏无向', patch: { edges: '0-1,0-2,1-2,1-3,2-3', directed: 'no', n: '4' } },
      { label: '稠密无向', patch: { edges: '0-1,0-2,0-3,1-2,1-3,2-3', directed: 'no', n: '4' } },
      { label: '有向图', patch: { edges: '0-1,1-2,2-0,0-3', directed: 'yes', n: '4' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.n);
      const directed = inp.directed === 'yes';
      const parsed = String(inp.edges).split(/[,，\s]+/).filter(Boolean).map((s) => {
        const mres = s.match(/^(\d+)[-→](\d+)$/);
        return mres ? [Number(mres[1]), Number(mres[2])] : null;
      });
      const issues: any[] = [];
      if (parsed.some((e) => e === null)) issues.push(bad('edges', '边要写成 a-b 形式'));
      if (!(n >= 2 && n <= 8)) issues.push(bad('n', '顶点数取 2 到 8'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const E = parsed.filter((e): e is [number, number] => e !== null);
        const badEdge = E.find(([a, b]) => a >= n || b >= n);
        if (badEdge) issues.push(bad('edges', '边 ' + badEdge[0] + '-' + badEdge[1] + ' 的顶点超出范围'));
      }
      if (!issues.some((i) => i.severity === 'error')) {
        const E = parsed.filter((e): e is [number, number] => e !== null);
        const mat: number[][] = [...Array(n).keys()].map(() => new Array<number>(n).fill(0));
        const adj: number[][] = [...Array(n).keys()].map(() => []);
        const radj: number[][] = [...Array(n).keys()].map(() => []);
        for (const [a, b] of E) {
          mat[a]![b] = 1;
          adj[a]!.push(b);
          radj[b]!.push(a);
          if (!directed) { mat[b]![a] = 1; adj[b]!.push(a); radj[a]!.push(b); }
        }
        specs.push({
          type: 'INIT',
          narration: (directed ? '有向图' : '无向图') + '：' + n + ' 个顶点、' + E.length + ' 条边',
          views: [{ kind: 'fields', label: '边集', items: E.map(([a, b]) => ({ text: a + (directed ? '→' : '-') + b, state: 'done' as const })) }],
        });
        specs.push({
          type: 'MATRIX',
          narration: '邻接矩阵：' + n + '×' + n + ' = ' + n * n + ' 个格子，判两点是否相邻一步到位',
          views: [{ kind: 'grid', label: '邻接矩阵', columns: [...Array(n).keys()].map((c) => String(c)), rowHeaders: [...Array(n).keys()].map((r) => 'v' + r), rows: mat.map((r, ri) => r.map((v, ci) => ({ text: v ? '1' : '0', state: v ? ('done' as const) : ('idle' as const) }))) }],
          metrics: [{ label: '矩阵格子', value: n * n }, { label: '边数', value: E.length }],
        });
        specs.push({
          type: 'LIST',
          narration: '邻接表：' + n + ' 个头指针 + ' + (directed ? E.length : E.length * 2) + ' 个边结点，只存真实存在的边',
          views: [{ kind: 'fields', label: '邻接表', items: adj.map((list, r) => ({ text: list.length ? list.join(' → ') : '∅', sub: 'v' + r + '（' + list.length + ' 个）', state: list.length ? ('done' as const) : ('idle' as const) })) }],
          metrics: [{ label: '边结点', value: directed ? E.length : E.length * 2 }],
        });
        if (directed) {
          specs.push({
            type: 'REVERSE',
            narration: '有向图还要逆邻接表：查「谁指向我」时用它',
            views: [{ kind: 'fields', label: '逆邻接表', items: radj.map((list, r) => ({ text: list.length ? list.join(' → ') : '∅', sub: 'v' + r, state: list.length ? ('done' as const) : ('idle' as const) })) }],
          });
        }
        const density = E.length / (directed ? n * (n - 1) : (n * (n - 1)) / 2);
        specs.push({
          type: 'DONE',
          narration: '稀疏度：边占可能边数的 ' + (density * 100).toFixed(1) + '%，' + (density < 0.5 ? '偏稀疏，邻接表更省' : '偏稠密，邻接矩阵更直接'),
          views: [{ kind: 'chips', label: '结论', items: [{ text: (density * 100).toFixed(1) + '%', sub: density < 0.5 ? '邻接表' : '邻接矩阵', state: 'done' as const }] }],
          metrics: [{ label: '密度百分比', value: Number((density * 100).toFixed(1)) }, { label: '推荐结构', value: density < 0.5 ? '邻接表' : '邻接矩阵' }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 5. ALU 标志位与溢出 ----------
const aluFlags: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.alu-flags", "co", "ALU 标志位与溢出", { a: "100", b: "50", op: "add", bits: "8" });
  const FIELDS = [
    { key: 'a', label: '操作数 A（带符号十进制）', type: 'number' as const, min: -255, max: 255 },
    { key: 'b', label: '操作数 B（带符号十进制）', type: 'number' as const, min: -255, max: 255 },
    { key: 'op', label: '运算', type: 'select' as const, options: [{ value: 'add', label: 'A + B' }, { value: 'sub', label: 'A − B' }] },
    { key: 'bits', label: '字长（位）', type: 'select' as const, options: [{ value: '8', label: '8 位' }, { value: '16', label: '16 位' }] },
  ];
  return {
    meta,
    summary: 'SF 看结果符号，ZF 看是否为 0，CF 看无符号进/借位，OF 看带符号溢出。',
    takeaway: '同一结果，无符号看 CF、带符号看 OF；OF = 两操作数同号且与结果异号。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '正溢出 OF=1', patch: { a: '100', b: '50', op: 'add', bits: '8' } },
      { label: '无符号借位 CF=1', patch: { a: '5', b: '9', op: 'sub', bits: '8' } },
      { label: '结果为零 ZF=1', patch: { a: '77', b: '77', op: 'sub', bits: '8' } },
    ],
    simulate(inp: any) {
      const a = Number(inp.a), b = Number(inp.b);
      const bits = Number(inp.bits);
      const op = String(inp.op);
      const issues: any[] = [];
      const lim = Math.pow(2, bits - 1);
      if (op !== 'add' && op !== 'sub') issues.push(bad('op', '只支持 add / sub'));
      if (!(a >= -lim && a < lim && b >= -lim && b < lim)) issues.push(bad('a', bits + ' 位带符号数的输入要在 ' + -lim + ' 到 ' + (lim - 1) + ' 之间'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const range = Math.pow(2, bits);
        const ua = a < 0 ? a + range : a;
        const ub = b < 0 ? b + range : b;
        const toBin = (v: number) => v.toString(2).padStart(bits, '0');
        specs.push({
          type: 'INIT',
          narration: 'A = ' + a + '（补码 ' + toBin(ua) + '），B = ' + b + '（补码 ' + toBin(ub) + '），' + (op === 'add' ? '相加' : '相减'),
          views: [{ kind: 'bits', label: '机器数', groups: [{ label: 'A 补码', bits: toBin(ua).split('').map(Number), splitAt: 1 }, { label: 'B 补码', bits: toBin(ub).split('').map(Number), splitAt: 1 }] }],
        });
        const raw = op === 'add' ? ua + ub : ua - ub;
        const wrapped = ((raw % range) + range) % range;
        const signed = wrapped >= lim ? wrapped - range : wrapped;
        const cf = op === 'add' ? (raw >= range ? 1 : 0) : (raw < 0 ? 1 : 0);
        const zf = signed === 0 ? 1 : 0;
        const sf = wrapped >= lim ? 1 : 0;
        const sa = a < 0, sb = b < 0, sr = signed < 0;
        const of = op === 'add' ? ((sa === sb && sr !== sa) ? 1 : 0) : ((sa !== sb && sr !== sa) ? 1 : 0);
        specs.push({
          type: 'CALC',
          narration: '按位' + (op === 'add' ? '相加' : '相减') + '得 ' + toBin(wrapped) + '（十进制 ' + wrapped + '），按带符号解释为 ' + signed,
          views: [
            { kind: 'bits', label: '结果补码', groups: [{ label: '结果', bits: toBin(wrapped).split('').map(Number), splitAt: 1 }] },
            { kind: 'fields', label: '两种解释', items: [{ text: String(wrapped), sub: '无符号读法' }, { text: String(signed), sub: '带符号读法' }] }],
          metrics: [{ label: '无符号', value: wrapped }, { label: '带符号', value: signed }],
        });
        specs.push({
          type: 'FLAGS',
          narration: '标志位：CF=' + cf + ' ZF=' + zf + ' SF=' + sf + ' OF=' + of,
          views: [{ kind: 'chips', label: '标志', items: [
            { text: 'CF ' + cf, sub: op === 'add' ? '无符号进位' : '无符号借位', state: cf ? ('warn' as const) : ('ok' as const) },
            { text: 'ZF ' + zf, sub: '结果是否为 0', state: zf ? ('done' as const) : ('idle' as const) },
            { text: 'SF ' + sf, sub: '结果符号位', state: sf ? ('warn' as const) : ('idle' as const) },
            { text: 'OF ' + of, sub: '带符号溢出', state: of ? ('bad' as const) : ('ok' as const) },
          ] }],
          metrics: [{ label: 'CF', value: cf }, { label: 'ZF', value: zf }, { label: 'SF', value: sf }, { label: 'OF', value: of }],
        });
        specs.push({
          type: 'DONE',
          narration: (of ? '带符号运算溢出，结果 ' + signed + ' 不可信；' : '带符号结果 ' + signed + ' 正确；') + (cf ? '无符号运算' + (op === 'add' ? '进位' : '借位') + '，无符号结果不可信。' : '无符号结果 ' + wrapped + ' 也正确。'),
          views: [{ kind: 'fields', label: '结论', items: [{ text: of ? '带符号溢出' : '带符号正常', state: of ? ('bad' as const) : ('done' as const) }, { text: cf ? '无符号' + (op === 'add' ? '进位' : '借位') : '无符号正常', state: cf ? ('bad' as const) : ('done' as const) }] }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 6. 存储器扩展 ----------
const memExpand: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.mem-expand", "co", "存储器扩展", { want: "64", chipK: "8", chipW: "8", mdr: "8" });
  const FIELDS = [
    { key: 'want', label: '目标容量（KB）', type: 'number' as const, min: 1, max: 4096 },
    { key: 'chipK', label: '单片容量（KB）', type: 'number' as const, min: 1, max: 1024 },
    { key: 'chipW', label: '单片字长（位）', type: 'number' as const, min: 1, max: 64 },
    { key: 'mdr', label: 'MDR 位宽（数据总线位）', type: 'number' as const, min: 1, max: 64 },
  ];
  return {
    meta,
    summary: '位扩展补字长，字扩展补容量，两者同时用就是字位同时扩展。',
    takeaway: '芯片数 = 目标容量/单片容量 × 目标字长/单片字长；片选线数 = 字扩展组数取 log2。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '字位同时扩展', patch: { want: '64', chipK: '8', chipW: '8', mdr: '16' } },
      { label: '纯位扩展', patch: { want: '16', chipK: '16', chipW: '4', mdr: '8' } },
      { label: '纯字扩展', patch: { want: '64', chipK: '16', chipW: '8', mdr: '8' } },
    ],
    simulate(inp: any) {
      const want = Number(inp.want), chipK = Number(inp.chipK), chipW = Number(inp.chipW), mdr = Number(inp.mdr);
      const issues: any[] = [];
      if (!(want > 0 && chipK > 0 && chipW > 0 && mdr > 0)) issues.push(bad('want', '四个参数都要是正数'));
      else if (want % chipK !== 0) issues.push(bad('want', '目标容量要能被单片容量整除'));
      else if (mdr % chipW !== 0) issues.push(bad('mdr', 'MDR 位宽要能被单片字长整除'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const bitExp = mdr / chipW;
        const wordExp = want / chipK;
        const chips = bitExp * wordExp;
        const addrBits = Math.log2(want * 1024 / mdr);
        const chipSel = Math.log2(wordExp);
        specs.push({
          type: 'INIT',
          narration: '目标 ' + want + 'KB、数据总线 ' + mdr + ' 位；现有芯片 ' + chipK + 'KB × ' + chipW + ' 位',
          views: [{ kind: 'fields', label: '需求', items: [{ text: want + ' KB', sub: '容量' }, { text: mdr + ' 位', sub: '字长' }, { text: chipK + 'KB×' + chipW + '位', sub: '单片' }] }],
        });
        specs.push({
          type: 'BIT',
          narration: bitExp === 1 ? '字长已够，不需要位扩展' : '位扩展：' + mdr + ' ÷ ' + chipW + ' = ' + bitExp + ' 片并成一组，凑满 ' + mdr + ' 位',
          views: [{ kind: 'chips', label: '位扩展（一组内并联）', items: [...Array(bitExp).keys()].map((i) => ({ text: '片' + (i + 1), sub: 'D' + (i * chipW) + '–' + ((i + 1) * chipW - 1), state: 'done' as const })) }],
          metrics: [{ label: '位扩展倍数', value: bitExp }],
        });
        specs.push({
          type: 'WORD',
          narration: wordExp === 1 ? '容量已够，不需要字扩展' : '字扩展：' + want + ' ÷ ' + chipK + ' = ' + wordExp + ' 组，用高 ' + chipSel + ' 位地址做片选',
          views: [{ kind: 'chips', label: '字扩展（分组串联）', items: [...Array(wordExp).keys()].map((i) => ({ text: '组' + (i + 1), sub: '片选 ' + i.toString(2).padStart(chipSel, '0'), state: 'done' as const })) }],
          metrics: [{ label: '字扩展组数', value: wordExp }, { label: '片选位数', value: chipSel }],
        });
        specs.push({
          type: 'DONE',
          narration: '共需 ' + bitExp + ' × ' + wordExp + ' = ' + chips + ' 片；地址线 ' + addrBits + ' 位（' + want + 'KB×1024 ÷ ' + mdr + ' 字节/单元），数据线 ' + mdr + ' 位',
          views: [{ kind: 'fields', label: '结论', items: [{ text: String(chips), sub: '芯片总数' }, { text: String(addrBits), sub: '地址线位数' }, { text: String(chipSel), sub: '片选线位数' }] }],
          metrics: [{ label: '芯片数', value: chips }, { label: '地址线位数', value: addrBits }, { label: '片选位数', value: chipSel }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 7. 流水线吞吐率/加速比/效率 ----------
const pipePerf: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.pipe-perf", "co", "流水线性能指标", { stages: "5", dt: "2", n: "100", k: "0" });
  const FIELDS = [
    { key: 'stages', label: '流水线段数 k（功能段数）', type: 'number' as const, min: 2, max: 12 },
    { key: 'dt', label: '时钟周期 Δt（ns，取最慢段）', type: 'number' as const, min: 1, max: 100 },
    { key: 'n', label: '任务数 n', type: 'number' as const, min: 1, max: 1000 },
    { key: 'k', label: '每任务重复段数（一般取 0 或 1）', type: 'number' as const, min: 0, max: 1 },
  ];
  return {
    meta,
    summary: 'TP = n/时间，S = 顺序时间/流水时间，E = 实际用时/理想用时。',
    takeaway: '任务数越多越接近理想加速比 k；段数变多时空载时间 (k−1)Δt 也变长。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { stages: '5', dt: '2', n: '100', k: '0' } },
      { label: '任务很少', patch: { stages: '5', dt: '2', n: '5', k: '0' } },
      { label: '每任务重复一次', patch: { stages: '4', dt: '1', n: '10', k: '1' } },
    ],
    simulate(inp: any) {
      const k = Number(inp.stages), dt = Number(inp.dt), n = Number(inp.n), r = Number(inp.k);
      const issues: any[] = [];
      if (!(k >= 2 && n >= 1 && dt > 0)) issues.push(bad('stages', '段数至少 2、任务数至少 1、周期为正'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const seq = n * (r + 1) * k * dt;
        const pipe = ((k - 1) + n * (r + 1)) * dt;
        const tp = n / pipe;
        const speed = seq / pipe;
        const eff = speed / k;
        specs.push({
          type: 'INIT',
          narration: k + ' 段流水线，Δt=' + dt + 'ns，' + n + ' 个任务' + (r ? '，每个任务重复 ' + (r + 1) + ' 次' : ''),
          views: [{ kind: 'timeline', label: '一个任务流经 ' + k + ' 段', span: k, segments: [...Array(k).keys()].map((i) => ({ start: i, end: i + 1, label: 'S' + (i + 1), state: 'active' as const })) }],
        });
        specs.push({
          type: 'SEQ',
          narration: '顺序执行时间 = n×(r+1)×k×Δt = ' + seq + ' ns',
          views: [{ kind: 'fields', label: '顺序', items: [{ text: seq + ' ns', sub: '总时间' }] }],
          metrics: [{ label: '顺序时间', value: seq }],
        });
        specs.push({
          type: 'PIPE',
          narration: '流水线时间 = [(k−1) + n×(r+1)]×Δt = ' + pipe + ' ns（其中空载 (k−1)Δt = ' + (k - 1) * dt + ' ns）',
          views: [{ kind: 'timeline', label: '流水线时空图', span: k + n - 1, segments: [...Array(n).keys()].map((i) => ({ start: i, end: i + k, label: 'T' + (i + 1), state: 'done' as const })) }],
          metrics: [{ label: '流水时间', value: pipe }, { label: '空载时间', value: (k - 1) * dt }],
        });
        specs.push({
          type: 'TP',
          narration: '吞吐率 TP = n ÷ ' + pipe + ' = ' + tp.toFixed(4) + ' 条/ns（理想上限 1/Δt = ' + (1 / dt).toFixed(4) + '）',
          views: [{ kind: 'fields', label: '吞吐率', items: [{ text: tp.toFixed(4) + ' /ns', sub: '实际' }, { text: (1 / dt).toFixed(4) + ' /ns', sub: '理想上限' }] }],
          metrics: [{ label: '吞吐率每ns', value: Number(tp.toFixed(4)) }],
        });
        specs.push({
          type: 'SE',
          narration: '加速比 S = ' + seq + ' ÷ ' + pipe + ' = ' + speed.toFixed(2) + '（上限 ' + k + '）；效率 E = S ÷ k = ' + eff.toFixed(4),
          views: [{ kind: 'bars', label: '加速比与上限', max: k, items: [{ label: '实际 S', value: Number(speed.toFixed(2)), state: 'done' as const }, { label: '理想 k', value: k, state: 'active' as const }] }],
          metrics: [{ label: '加速比', value: Number(speed.toFixed(2)) }, { label: '效率', value: Number(eff.toFixed(4)) }],
        });
        specs.push({
          type: 'DONE',
          narration: '任务数 ' + n + ' 时效率只有 ' + (eff * 100).toFixed(1) + '%：' + (n < k * 3 ? '任务太少，空载占比大' : '任务够多，接近理想'),
          views: [{ kind: 'chips', label: '结论', items: [{ text: (eff * 100).toFixed(1) + '%', sub: '流水线效率', state: eff > 0.8 ? ('done' as const) : ('warn' as const) }] }],
          metrics: [{ label: '效率百分比', value: Number((eff * 100).toFixed(1)) }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

export const batch12 = { prim, mergeSort, postfix, graphStorage, aluFlags, memExpand, pipePerf } as const;
