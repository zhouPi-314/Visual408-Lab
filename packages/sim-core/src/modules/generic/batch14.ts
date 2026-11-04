import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

/**
 * 第十四批：KMP 匹配过程、中序线索化、一元多项式链表相加、后缀式建树、
 * 汉明码、Cache 平均访问时间、行波与先行进位。
 */

// ---------- 1. KMP 匹配过程 ----------
const kmpMatch: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.kmp-match", "ds", "KMP 匹配过程", { text: "ababcababa", pat: "ababa" });
  const FIELDS = [
    { key: 'text', label: '主串（小写字母）', type: 'text' as const, placeholder: 'ababcababa' },
    { key: 'pat', label: '模式串（小写字母）', type: 'text' as const, placeholder: 'ababa' },
  ];
  return {
    meta,
    summary: '失配时主串指针不回退，模式串按 next 数组往后滑。',
    takeaway: 'next 记录最长相等前后缀；失配后 j 跳到 next[j−1]，i 永远向前走。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { text: 'ababcababa', pat: 'ababa' } },
      { label: '多次命中', patch: { text: 'aaaaaa', pat: 'aaa' } },
      { label: '找不到', patch: { text: 'abcabd', pat: 'abcd' } },
    ],
    simulate(inp: any) {
      const t = String(inp.text).toLowerCase();
      const pat = String(inp.pat).toLowerCase();
      const issues: any[] = [];
      if (!/^[a-z]+$/.test(t) || !/^[a-z]+$/.test(pat)) issues.push(bad('text', '主串和模式串只能用小写字母'));
      else if (pat.length > t.length) issues.push(bad('pat', '模式串不能比主串长'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const pi = new Array<number>(pat.length).fill(0);
        for (let i = 1, j = 0; i < pat.length; i++) {
          while (j > 0 && pat[i] !== pat[j]) j = pi[j - 1]!;
          if (pat[i] === pat[j]) j++;
          pi[i] = j;
        }
        specs.push({
          type: 'NEXT',
          narration: '模式串 next 数组：' + pi.join(','),
          views: [
            { kind: 'chips', label: '主串', items: [...t].map((c) => ({ text: c, state: 'idle' as const })) },
            { kind: 'fields', label: 'next', items: pi.map((v, i) => ({ text: String(v), sub: pat[i] + '@' + i })) },
          ],
        });
        let i = 0, j = 0, comps = 0, skips = 0;
        const hits: number[] = [];
        while (i < t.length) {
          if (t[i] === pat[j]) {
            comps++;
            const ch = t[i];
            j++;
            specs.push({
              type: 'MATCH',
              narration: 'i=' + i + '、j=' + j + '：' + ch + ' 与 ' + pat[j - 1] + ' 匹配',
              views: [{ kind: 'chips', label: '对齐位置', items: [...t].map((c, k) => ({ text: c, sub: k >= i - j + 1 && k <= i ? '窗口' : '', state: k === i ? ('active' as const) : k >= i - j + 1 && k <= i ? ('done' as const) : ('idle' as const) })) }],
              metrics: [{ label: '比较次数', value: comps }, { label: '已匹配长度', value: j }],
            });
            if (j === pat.length) {
              hits.push(i - pat.length + 1);
              j = pi[j - 1]!;
              i++;
              continue;
            }
            i++;
          } else if (j > 0) {
            comps++;
            const bj = j;
            j = pi[j - 1]!;
            skips++;
            specs.push({
              type: 'FALLBACK',
              narration: 'i=' + i + ' 失配：j 从 ' + bj + ' 跳到 next[' + (bj - 1) + ']=' + j + '，主串指针不动',
              views: [{ kind: 'chips', label: '对齐位置', items: [...t].map((c, k) => ({ text: c, sub: k === i ? '失配' : '', state: k === i ? ('bad' as const) : k >= i - bj && k < i ? ('warn' as const) : ('idle' as const) })) }],
              metrics: [{ label: '比较次数', value: comps }, { label: '回退次数', value: skips }],
            });
          } else {
            comps++;
            i++;
          }
        }
        specs.push({
          type: 'DONE',
          narration: hits.length ? '在位置 ' + hits.join('、') + ' 命中，共比较 ' + comps + ' 次' : '未匹配到，共比较 ' + comps + ' 次',
          views: [{ kind: 'chips', label: '命中位置', items: hits.length ? hits.map((h) => ({ text: String(h), state: 'done' as const })) : [{ text: '无', state: 'warn' as const }] }],
          metrics: [{ label: '比较次数', value: comps }, { label: '命中次数', value: hits.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 2. 中序线索化 ----------
const threadedTree: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.threaded-tree", "ds", "中序线索二叉树", { tree: "A,B,D,E,C,F" });
  const FIELDS = [{ key: 'tree', label: '层序序列（# 表示空）', type: 'text' as const, placeholder: 'A,B,D,E,C,F' }];
  return {
    meta,
    summary: '空左孩子指向前驱，空右孩子指向后继，遍历不再需要栈。',
    takeaway: 'n 个结点有 n+1 个空指针；线索化后中序找后继：右线索即后继，否则走右子树最左下。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { tree: 'A,B,D,E,C,F' } },
      { label: '左斜链', patch: { tree: 'A,B,#,C' } },
    ],
    simulate(inp: any) {
      const arr = String(inp.tree).split(/[,，\s]+/).filter(Boolean);
      const issues = arr.length < 2 ? [bad('tree', '至少 2 个结点')] : [];
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const nodes: { v: string; l: number; r: number }[] = [];
        const build = (idx: number): number => {
          if (idx >= arr.length || arr[idx] === '#') return -1;
          const me = nodes.length;
          nodes.push({ v: arr[idx]!, l: -1, r: -1 });
          nodes[me]!.l = build(2 * me + 1);
          nodes[me]!.r = build(2 * me + 2);
          return me;
        };
        build(0);
        const order: number[] = [];
        const dfs = (u: number) => { if (u < 0) return; dfs(nodes[u]!.l); order.push(u); dfs(nodes[u]!.r); };
        dfs(0);
        specs.push({
          type: 'INIT',
          narration: nodes.length + ' 个结点，中序序列：' + order.map((u) => nodes[u]!.v).join(','),
          views: [{ kind: 'chips', label: '中序序列', items: order.map((u) => ({ text: nodes[u]!.v, state: 'idle' as const })) }],
        });
        const threads: { node: string; dir: string; to: string }[] = [];
        order.forEach((u, k) => {
          const pre = order[k - 1];
          const nxt = order[k + 1];
          if (nodes[u]!.l < 0 && pre !== undefined) threads.push({ node: nodes[u]!.v, dir: '左线索→前驱', to: nodes[pre]!.v });
          if (nodes[u]!.r < 0 && nxt !== undefined) threads.push({ node: nodes[u]!.v, dir: '右线索→后继', to: nodes[nxt]!.v });
          specs.push({
            type: 'THREAD',
            narration: '访问 ' + nodes[u]!.v + '：' + (nodes[u]!.l < 0 ? '左空 → 前驱 ' + (pre !== undefined ? nodes[pre]!.v : '无') : '有左孩子') + '；' + (nodes[u]!.r < 0 ? '右空 → 后继 ' + (nxt !== undefined ? nodes[nxt]!.v : '无') : '有右孩子'),
            views: [
              { kind: 'chips', label: '中序序列（已处理标色）', items: order.map((x, j) => ({ text: nodes[x]!.v, state: j < k ? ('done' as const) : j === k ? ('active' as const) : ('idle' as const) })) },
              { kind: 'fields', label: '已加线索', items: threads.map((th) => ({ text: th.to, sub: th.node + ' ' + th.dir, state: 'done' as const })) },
            ],
            metrics: [{ label: '线索数', value: threads.length }],
          });
        });
        specs.push({
          type: 'DONE',
          narration: '共加 ' + threads.length + ' 条线索（n=' + nodes.length + ' 时空指针恰有 n+1=' + (nodes.length + 1) + ' 个）',
          views: [{ kind: 'fields', label: '线索表', items: threads.map((th) => ({ text: th.node + ' → ' + th.to, sub: th.dir })) }],
          metrics: [{ label: '线索数', value: threads.length }, { label: '结点数', value: nodes.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 3. 一元多项式链表相加 ----------
const polyAdd: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.poly-add", "ds", "一元多项式相加", { a: "1,3;2,2;3,0", b: "4,3;-2,2;5,1" });
  const FIELDS = [
    { key: 'a', label: '多项式 A（系数,指数；分号分隔）', type: 'text' as const, placeholder: '1,3;2,2' },
    { key: 'b', label: '多项式 B（系数,指数；分号分隔）', type: 'text' as const, placeholder: '4,3;-2,2' },
  ];
  return {
    meta,
    summary: '两条按指数递减的链表做归并：指数大的直接接上，相等的系数相加。',
    takeaway: '多项式相加是有序链表归并的特例：同指数合并，系数归零则删项。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { a: '1,3;2,2;3,0', b: '4,3;-2,2;5,1' } },
      { label: '相消为零', patch: { a: '2,5;-3,2', b: '-2,5;3,2' } },
    ],
    simulate(inp: any) {
      const parse = (raw: string): [number, number][] => String(raw).split(/[;，]/).map((s) => s.split(/[,，\s]+/).filter(Boolean).map(Number)).filter((a) => a.length === 2).map((a) => [a[0]!, a[1]!] as [number, number]);
      const A = parse(inp.a), B = parse(inp.b);
      const issues: any[] = [];
      if (!A.length || !B.length) issues.push(bad('a', '两个多项式都至少要一项（系数,指数）'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const term = (c: number, e: number) => c + 'x^' + e;
        const chips = (arr: [number, number][], hi: number) => arr.map(([c, e], i) => ({ text: term(c, e), sub: i === hi ? '指针' : '', state: i === hi ? ('active' as const) : ('idle' as const) }));
        specs.push({
          type: 'INIT',
          narration: 'A：' + A.map(([c, e]) => term(c, e)).join(' + ') + '；B：' + B.map(([c, e]) => term(c, e)).join(' + '),
          views: [{ kind: 'chips', label: 'A 链表', items: A.map(([c, e]) => ({ text: term(c, e), state: 'idle' as const })) }, { kind: 'chips', label: 'B 链表', items: B.map(([c, e]) => ({ text: term(c, e), state: 'idle' as const })) }],
        });
        const map = new Map<number, number>();
        for (const [c, e] of A) map.set(e, (map.get(e) ?? 0) + c);
        for (const [c, e] of B) map.set(e, (map.get(e) ?? 0) + c);
        const result = [...map.entries()].filter(([, c]) => c !== 0).map(([e, c]) => [c, e] as [number, number]).sort((x, y) => y[1] - x[1]);
        let ia = 0, ib = 0, step = 0;
        while (ia < A.length || ib < B.length) {
          step++;
          const ea = A[ia]?.[1], eb = B[ib]?.[1];
          let note = '';
          if (ea !== undefined && (eb === undefined || ea > eb)) { note = '取 A 的 ' + term(A[ia]![0]!, ea) + '（指数更大，直接接上）'; ia++; }
          else if (eb !== undefined && (ea === undefined || eb > ea)) { note = '取 B 的 ' + term(B[ib]![0]!, eb) + '（指数更大，直接接上）'; ib++; }
          else { const s = (A[ia]?.[0] ?? 0) + (B[ib]?.[0] ?? 0); note = '指数 ' + ea + ' 相同：' + (A[ia]?.[0] ?? 0) + ' + ' + (B[ib]?.[0] ?? 0) + ' = ' + s + (s === 0 ? '，系数为 0，删项' : '，合并为一项'); ia++; ib++; }
          specs.push({
            type: 'MERGE',
            narration: step + '. ' + note,
            views: [{ kind: 'chips', label: 'A 指针位置', items: chips(A, ia) }, { kind: 'chips', label: 'B 指针位置', items: chips(B, ib) }],
            metrics: [{ label: '步数', value: step }],
          });
        }
        specs.push({
          type: 'DONE',
          narration: '和式：' + (result.length ? result.map(([c, e]) => term(c, e)).join(' + ') : '零多项式'),
          views: [{ kind: 'chips', label: '结果链表', items: result.length ? result.map(([c, e]) => ({ text: term(c, e), state: 'done' as const })) : [{ text: '0', state: 'done' as const }] }],
          metrics: [{ label: '结果项数', value: result.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 4. 后缀式建表达式树 ----------
const exprTree: GenericModuleDef<any> = (() => {
  const { meta, input } = M("ds.expr-tree", "ds", "后缀式建表达式树", { post: "34*2+5-" });
  const FIELDS = [{ key: 'post', label: '后缀表达式（数字与 + - * /）', type: 'text' as const, placeholder: '34*2+' }];
  return {
    meta,
    summary: '数字压栈成叶；操作符弹出两棵子树拼成新树再压回。',
    takeaway: '后缀式建树只需一个栈：先弹出的是右子树，后弹出的是左子树。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { post: '34*2+5-' } },
      { label: '简单加法', patch: { post: '12+' } },
    ],
    simulate(inp: any) {
      const post = String(inp.post);
      const issues: any[] = [];
      if (!/^[0-9+\-*/]+$/.test(post)) issues.push(bad('post', '只允许数字和 + - * /'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const st: string[] = [];
        specs.push({ type: 'INIT', narration: '后缀式 ' + post + '，从左到右扫描', views: [{ kind: 'chips', label: '扫描串', items: [...post].map((c) => ({ text: c, state: 'idle' as const })) }] });
        [...post].forEach((c, i) => {
          const scan = { kind: 'chips' as const, label: '扫描串', items: [...post].map((x, k) => ({ text: x, state: k < i ? ('done' as const) : k === i ? ('active' as const) : ('idle' as const) })) };
          if (/[0-9]/.test(c)) {
            st.push(c);
            specs.push({ type: 'PUSH', narration: '第 ' + (i + 1) + ' 个字符 ' + c + '：数字，压入单叶树', views: [scan, { kind: 'fields', label: '栈（底→顶）', items: st.map((x) => ({ text: x, state: 'active' as const })) }], metrics: [{ label: '栈大小', value: st.length }] });
          } else {
            const r = st.pop(), l = st.pop();
            if (l === undefined || r === undefined) { issues.push(bad('post', '表达式不合法：操作符 ' + c + ' 缺少操作数')); return; }
            const node = '(' + l + c + r + ')';
            st.push(node);
            specs.push({ type: 'BUILD', narration: '第 ' + (i + 1) + ' 个字符 ' + c + '：弹出右 ' + r + '、左 ' + l + '，拼成 ' + node, views: [scan, { kind: 'fields', label: '栈（底→顶）', items: st.map((x) => ({ text: x, state: 'done' as const })) }], metrics: [{ label: '栈大小', value: st.length }] });
          }
        });
        if (!issues.some((x) => x.severity === 'error')) {
          specs.push({ type: 'DONE', narration: '表达式树根：' + st[0] + '；中序遍历（补括号）即还原中缀式', views: [{ kind: 'chips', label: '最终栈', items: st.map((x) => ({ text: x, state: 'done' as const })) }], metrics: [{ label: '字符数', value: post.length }, { label: '内部结点', value: [...post].filter((c) => /[+\-*/]/.test(c)).length }] });
        }
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 5. 汉明码检错纠错 ----------
const hamming: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.hamming-code", "co", "汉明码检错纠错", { data: "1010", flip: "0" });
  const FIELDS = [
    { key: 'data', label: '数据位（从高位到低位）', type: 'text' as const, placeholder: '1010' },
    { key: 'flip', label: '模拟出错的位号（0 表示不翻转）', type: 'number' as const, min: 0, max: 7 },
  ];
  return {
    meta,
    summary: '校验位放在 2 的幂位上，各自监督一组； syndrome 直接指出出错位号。',
    takeaway: 'k 位数据需要满足 2^r ≥ k+r+1；纠错码比检错码多花校验位，但能自动纠正单比特错。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '无错', patch: { data: '1010', flip: '0' } },
      { label: '数据位出错', patch: { data: '1010', flip: '6' } },
      { label: '校验位出错', patch: { data: '1010', flip: '3' } },
    ],
    simulate(inp: any) {
      const data = String(inp.data).replace(/[^01]/g, "");
      const flip = Number(inp.flip);
      const issues: any[] = [];
      if (data.length < 2 || data.length > 4) issues.push(bad('data', '数据位取 2 到 4 位'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const k = data.length;
        let r = 1;
        while (Math.pow(2, r) < k + r + 1) r++;
        const total = k + r;
        const code = new Array<number>(total + 1).fill(0);
        let di = 0;
        for (let pos = 1; pos <= total; pos++) {
          if ((pos & (pos - 1)) !== 0) { code[pos] = Number(data[di] ?? '0'); di++; }
        }
        const groups: { p: number; covers: number[] }[] = [];
        for (let j = 0; j < r; j++) {
          const p = Math.pow(2, j);
          const covers: number[] = [];
          for (let pos = 1; pos <= total; pos++) if (pos & p) covers.push(pos);
          const parity = covers.filter((x) => x !== p).reduce((acc, x) => acc ^ code[x]!, 0);
          code[p] = parity;
          groups.push({ p, covers });
        }
        const sent = code.slice(1);
        specs.push({
          type: 'SIZE',
          narration: k + ' 位数据要 ' + r + ' 位校验（2^' + r + ' ≥ ' + k + '+' + r + '+1），码字共 ' + total + ' 位',
          views: [{ kind: 'fields', label: '配置', items: [{ text: String(r), sub: '校验位数' }, { text: String(total), sub: '码字长度' }] }],
          metrics: [{ label: '校验位数', value: r }],
        });
        specs.push({
          type: 'PARITY',
          narration: '校验位放在位号 ' + groups.map((g) => g.p).join('、') + '（2 的幂），各监督一组偶校验',
          views: [{ kind: 'fields', label: '监督组', items: groups.map((g) => ({ text: 'p' + g.p + '=' + code[g.p], sub: '监督位号 ' + g.covers.filter((x) => x !== g.p).join(','), state: 'done' as const })) }],
        });
        specs.push({
          type: 'SEND',
          narration: '发送码字（位号 1→' + total + '）：' + sent.join(''),
          views: [{ kind: 'bits', label: '码字', groups: [{ label: '位号 1 起', bits: sent }] }],
        });
        const recv = sent.slice();
        if (flip >= 1 && flip <= total) {
          recv[flip - 1] = (recv[flip - 1] ?? 0) ^ 1;
          specs.push({ type: 'NOISE', narration: '信道翻转了位号 ' + flip + '，接收方收到：' + recv.join(''), views: [{ kind: 'bits', label: '接收码字', groups: [{ label: '位号 1 起', bits: recv }] }], metrics: [{ label: '出错位', value: flip }] });
        }
        let syndrome = 0;
        for (const g of groups) {
          const par = g.covers.reduce((acc, x) => acc ^ recv[x - 1]!, 0);
          if (par) syndrome += g.p;
        }
        specs.push({
          type: 'SYNDROME',
          narration: syndrome ? '各组重新校验，syndrome = ' + syndrome + '，正好指出出错位号' : '所有监督组偶校验成立，syndrome = 0：没有单比特错',
          views: [{ kind: 'chips', label: 'syndrome', items: [{ text: String(syndrome), state: syndrome ? ('bad' as const) : ('ok' as const) }] }],
          metrics: [{ label: 'syndrome', value: syndrome }],
        });
        if (syndrome) recv[syndrome - 1] = (recv[syndrome - 1] ?? 0) ^ 1;
        const back = recv.filter((_, i) => ((i + 1) & i) !== 0).join('');
        specs.push({
          type: 'DONE',
          narration: (syndrome ? '翻转位 ' + syndrome + ' 后' : '无需纠正') + '恢复数据位：' + back + (back === data ? '（与原始一致）' : '（不一致！）'),
          views: [{ kind: 'chips', label: '恢复的数据', items: [{ text: back, sub: back === data ? '正确' : '错误', state: back === data ? ('done' as const) : ('bad' as const) }] }],
          metrics: [{ label: 'syndrome', value: syndrome }, { label: '校验位数', value: r }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 6. Cache 平均访问时间 ----------
const cacheAmat: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.cache-amat", "co", "Cache 平均访问时间", { hit: "95", tc: "10", tm: "100", mode: "sim" });
  const FIELDS = [
    { key: 'hit', label: '命中率（%）', type: 'number' as const, min: 0, max: 100 },
    { key: 'tc', label: 'Cache 访问时间（ns）', type: 'number' as const, min: 1, max: 100 },
    { key: 'tm', label: '主存访问时间（ns）', type: 'number' as const, min: 1, max: 2000 },
    { key: 'mode', label: '缺失损失算法', type: 'select' as const, options: [{ value: 'sim', label: '同时访问（命中即停）' }, { value: 'hier', label: '层次访问（先 Cache 后主存）' }] }];
  return {
    meta,
    summary: '同时访问 Ta = h·Tc + (1−h)·Tm；层次访问先付一次 Tc 再走主存。',
    takeaway: '命中率每差 1%，平均访问时间就差 (Tm−Tc) 的 1%——局部性值钱就贵在这。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '同时访问', patch: { hit: '95', tc: '10', tm: '100', mode: 'sim' } },
      { label: '层次访问', patch: { hit: '95', tc: '10', tm: '100', mode: 'hier' } },
      { label: '命中率掉到 80%', patch: { hit: '80', tc: '10', tm: '100', mode: 'sim' } },
    ],
    simulate(inp: any) {
      const h = Number(inp.hit) / 100, tc = Number(inp.tc), tm = Number(inp.tm);
      const mode = String(inp.mode);
      const issues: any[] = [];
      if (!(Number(inp.hit) >= 0 && Number(inp.hit) <= 100)) issues.push(bad('hit', '命中率取 0 到 100'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        specs.push({
          type: 'INIT',
          narration: '命中率 ' + (h * 100).toFixed(0) + '%，Tc=' + tc + 'ns，Tm=' + tm + 'ns',
          views: [{ kind: 'fields', label: '参数', items: [{ text: (h * 100).toFixed(0) + '%', sub: '命中率 h' }, { text: tc + ' ns', sub: 'Tc' }, { text: tm + ' ns', sub: 'Tm' }] }],
        });
        specs.push({
          type: 'HIT',
          narration: '命中占 ' + h.toFixed(2) + '（每次 ' + tc + 'ns），缺失占 ' + (1 - h).toFixed(2) + '（每次 ' + tm + 'ns）',
          views: [{ kind: 'bars', label: '时间构成（ns）', max: Math.max(tc, tm), items: [
            { label: '命中平均', value: Number((h * tc).toFixed(2)), state: 'done' as const },
            { label: '缺失平均', value: Number(((1 - h) * tm).toFixed(2)), state: 'warn' as const },
          ] }],
          metrics: [{ label: '命中贡献', value: Number((h * tc).toFixed(2)) }],
        });
        const ta = mode === 'hier' ? tc + (1 - h) * tm : h * tc + (1 - h) * tm;
        const formula = mode === 'hier' ? 'Ta = Tc + (1−h)×Tm = ' + tc + ' + ' + (1 - h).toFixed(2) + '×' + tm : 'Ta = h×Tc + (1−h)×Tm = ' + h.toFixed(2) + '×' + tc + ' + ' + (1 - h).toFixed(2) + '×' + tm;
        specs.push({
          type: 'DONE',
          narration: formula + ' = ' + ta.toFixed(2) + ' ns',
          views: [{ kind: 'fields', label: '平均访问时间', items: [{ text: ta.toFixed(2) + ' ns', sub: mode === 'hier' ? '层次访问' : '同时访问', state: 'done' as const }] }],
          metrics: [{ label: '平均访问时间', value: Number(ta.toFixed(2)) }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 7. 行波与先行进位 ----------
const adderDelay: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.adder-delay", "co", "加法器进位延迟", { bits: "4", per: "1", group: "4" });
  const FIELDS = [
    { key: 'bits', label: '加法器位数 n', type: 'number' as const, min: 2, max: 32 },
    { key: 'per', label: '每级门延迟（ns）', type: 'number' as const, min: 1, max: 10 },
    { key: 'group', label: 'CLA 分组大小', type: 'number' as const, min: 2, max: 8 },
  ];
  return {
    meta,
    summary: '行波进位一位一位传；先行进位让各组进位同时算出来。',
    takeaway: '行波延迟与位数成正比 (n+1)·t；4 位一组先行进位后降到常数级组内 + 组间几级。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '4 位行波', patch: { bits: '4', per: '1', group: '4' } },
      { label: '16 位行波太慢', patch: { bits: '16', per: '1', group: '4' } },
      { label: '16 位分组先行', patch: { bits: '16', per: '1', group: '4' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.bits), t = Number(inp.per), g = Number(inp.group);
      const issues: any[] = [];
      if (!(n >= 2 && n <= 32 && t > 0 && g >= 2)) issues.push(bad('bits', '位数 2–32、门延迟与分组大小都要为正'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const ripple = (n + 1) * t;
        specs.push({
          type: 'INIT',
          narration: n + ' 位加法器，每级门延迟 ' + t + 'ns',
          views: [{ kind: 'fields', label: '参数', items: [{ text: String(n), sub: '位数' }, { text: t + ' ns', sub: '每级延迟' }] }],
        });
        specs.push({
          type: 'RIPPLE',
          narration: '行波进位：进位从 C0 逐级传到 C' + n + '，延迟 = (n+1)×t = ' + ripple + ' ns',
          views: [{ kind: 'timeline', label: '进位链', span: n + 1, segments: [...Array(n + 1).keys()].map((i) => ({ start: i, end: i + 1, label: 'C' + i, state: 'active' as const })) }],
          metrics: [{ label: '行波延迟', value: ripple }],
        });
        const groups = Math.ceil(n / g);
        const inside = 2 * t;
        const between = Math.ceil(Math.log2(groups || 1) + 1) * t;
        const cla = inside + between + t;
        specs.push({
          type: 'CLA',
          narration: '先行进位：' + groups + ' 组各 ' + g + ' 位，组内生成/传播同时出（2 级门），组间再并行 ' + between.toFixed(0) + 'ns',
          views: [{ kind: 'chips', label: '分组', items: [...Array(groups).keys()].map((i) => ({ text: '组' + i, sub: '位 ' + (i * g) + '–' + Math.min(n - 1, (i + 1) * g - 1), state: 'done' as const })) }],
          metrics: [{ label: '组数', value: groups }],
        });
        specs.push({
          type: 'DONE',
          narration: '行波 ' + ripple + 'ns vs 先行进位约 ' + cla.toFixed(0) + 'ns，加速 ' + (ripple / cla).toFixed(2) + '×（代价是门数大增）',
          views: [{ kind: 'bars', label: '延迟对比（ns）', max: Math.max(ripple, cla), items: [
            { label: '行波进位', value: ripple, state: 'warn' as const },
            { label: '先行进位', value: Number(cla.toFixed(0)), state: 'done' as const },
          ] }],
          metrics: [{ label: '行波延迟', value: ripple }, { label: '先行延迟', value: Number(cla.toFixed(0)) }, { label: '加速倍数', value: Number((ripple / cla).toFixed(2)) }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

export const batch14 = { kmpMatch, threadedTree, polyAdd, exprTree, hamming, cacheAmat, adderDelay } as const;
