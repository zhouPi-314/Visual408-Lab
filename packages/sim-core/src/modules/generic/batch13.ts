import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

/**
 * 第十三批：Booth 乘法、fork 进程计数、哲学家就餐、最少资源防死锁、
 * i 节点最大文件长度、CIDR 路由聚合、跨网段 IP/MAC、时延带宽积。
 */

// ---------- 1. Booth 补码乘法 ----------
const booth: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.booth-mul", "co", "Booth 补码乘法", { m: "3", q: "-6", bits: "4" });
  const FIELDS = [
    { key: 'm', label: '被乘数 M（带符号十进制）', type: 'number' as const, min: -7, max: 7 },
    { key: 'q', label: '乘数 Q（带符号十进制）', type: 'number' as const, min: -7, max: 7 },
    { key: 'bits', label: '字长（位）', type: 'select' as const, options: [{ value: '4', label: '4 位' }, { value: '5', label: '5 位' }] },
  ];
  return {
    meta,
    summary: '看乘数末位与附加位的 10/01/00/11，做减、加或不动，再整体算术右移。',
    takeaway: 'Booth 不用先取绝对值，补码直接乘；连续 1 用一次减一次加抵消。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '正乘负', patch: { m: '3', q: '-6', bits: '4' } },
      { label: '两个正数', patch: { m: '5', q: '3', bits: '4' } },
      { label: '负乘负', patch: { m: '-4', q: '-3', bits: '5' } },
    ],
    simulate(inp: any) {
      const Mv = Number(inp.m), Qv = Number(inp.q), n = Number(inp.bits);
      const lim = Math.pow(2, n - 1);
      const issues: any[] = [];
      if (!(Mv >= -lim && Mv < lim && Qv >= -lim && Qv < lim)) issues.push(bad('m', n + ' 位时两个数都要在 ' + -lim + ' 到 ' + (lim - 1) + ' 之间'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const toBits = (v: number, w: number) => {
          const u = v < 0 ? Math.pow(2, w) + v : v;
          return u.toString(2).padStart(w, '0').split('').map((c) => Number(c));
        };
        const fromBits = (b: number[]) => {
          const u = b.reduce((acc, x) => acc * 2 + x, 0);
          return b[0] === 1 ? u - Math.pow(2, b.length) : u;
        };
        const str = (b: number[]) => b.join('');
        let A = toBits(0, n);
        let Q = toBits(Qv, n);
        let q1 = 0;
        const Mbits = toBits(Mv, n);
        specs.push({
          type: 'INIT',
          narration: 'M=' + Mv + '（' + str(Mbits) + '），Q=' + Qv + '（' + str(Q) + '），A=0，Q₋₁=0',
          views: [{ kind: 'fields', label: '初始寄存器', items: [{ text: str(A), sub: 'A' }, { text: str(Q), sub: 'Q' }, { text: String(q1), sub: 'Q₋₁' }, { text: str(Mbits), sub: 'M=' + Mv }] }],
        });
        const addSub = (cur: number[], delta: number[]) => {
          const v = fromBits(cur) + fromBits(delta);
          return toBits(v, n);
        };
        // 组合寄存器：A(n) 拼 Q(n)，外加 1 位 Q₋₁；每次加减只作用在 A 段
        for (let step = 0; step < n; step++) {
          const q0 = Q[n - 1]!;
          const pair = String(q0) + String(q1);
          let act = '00 或 11：A 不变';
          if (pair === '10') {
            const nv = fromBits(A) - fromBits(Mbits);
            A = toBits(nv, n);
            act = '10：A = A − M（' + fromBits(A) + '）';
          } else if (pair === '01') {
            const nv = fromBits(A) + fromBits(Mbits);
            A = toBits(nv, n);
            act = '01：A = A + M（' + fromBits(A) + '）';
          }
          // 算术右移：符号位复制，A 的最低位进入 Q 的最高位，Q 的最低位进入 Q₋₁
          const aSign = A[0]!;
          const aLow = A[n - 1]!;
          const qLow = Q[n - 1]!;
          A = [aSign, ...A.slice(0, n - 1)];
          Q = [aLow, ...Q.slice(0, n - 1)];
          q1 = qLow;
          specs.push({
            type: 'STEP',
            narration: '第 ' + (step + 1) + ' 步：Q₀Q₋₁=' + pair + '，' + act + '；整体算术右移',
            views: [{ kind: 'fields', label: '寄存器状态', items: [{ text: str(A), sub: 'A（' + fromBits(A) + '）' }, { text: str(Q), sub: 'Q（' + fromBits(Q) + '）' }, { text: String(q1), sub: 'Q₋₁' }] }],
            metrics: [{ label: '步数', value: step + 1 }, { label: 'A', value: fromBits(A) }],
          });
        }
        const prodBits = A.concat(Q);
        const prod = fromBits(prodBits.length === 2 * n ? prodBits.slice(0, 2 * n) : prodBits);
        specs.push({
          type: 'DONE',
          narration: '乘积 AQ = ' + str(prodBits) + '，按 2n 位补码读作 ' + prod + '（' + Mv + '×' + Qv + ' = ' + Mv * Qv + '）',
          views: [{ kind: 'bits', label: '乘积（2n 位补码）', groups: [{ label: 'A 段', bits: A, splitAt: 1 }, { label: 'Q 段', bits: Q, splitAt: 1 }] },
            { kind: 'chips', label: '校验', items: [{ text: String(prod), sub: prod === Mv * Qv ? '与手算一致' : '与手算不一致', state: prod === Mv * Qv ? ('done' as const) : ('bad' as const) }] }],
          metrics: [{ label: '乘积', value: prod }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();


// ---------- 2. fork 进程计数 ----------
const forkCount: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.fork-count", "os", "fork 进程计数", { forks: "3", prints: "1" });
  const FIELDS = [
    { key: 'forks', label: '连续 fork() 调用次数', type: 'number' as const, min: 1, max: 6 },
    { key: 'prints', label: 'fork 之后的打印语句条数', type: 'number' as const, min: 1, max: 4 },
  ];
  return {
    meta,
    summary: 'fork 返回两次：一次 fork 让进程数翻倍，n 次就是 2^n 个。',
    takeaway: 'fork 之后的每条语句，每个进程都会执行一次，所以输出行数 = 进程数 × 语句数。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '3 次 fork', patch: { forks: '3', prints: '1' } },
      { label: '4 次 fork 两句打印', patch: { forks: '4', prints: '2' } },
      { label: '1 次 fork', patch: { forks: '1', prints: '1' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.forks), prints = Number(inp.prints);
      const issues: any[] = [];
      if (!(n >= 1 && n <= 6)) issues.push(bad('forks', 'fork 次数取 1 到 6'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        let procs = [0];
        specs.push({ type: 'INIT', narration: '只有主进程 pid 0', views: [{ kind: 'chips', label: '进程集合', items: [{ text: 'p0', state: 'active' as const }] }] });
        for (let step = 1; step <= n; step++) {
          const next: number[] = [];
          procs.forEach((id) => { next.push(id); next.push(Math.max(...next) + 1); });
          procs = next;
          specs.push({
            type: 'FORK',
            narration: '第 ' + step + ' 次 fork：' + (procs.length / 2) + ' 个进程各创建一个子进程，共 ' + procs.length + ' 个',
            views: [{ kind: 'chips', label: '进程集合', items: procs.map((id, i) => ({ text: 'p' + id, sub: i >= procs.length / 2 ? '新建' : '', state: i >= procs.length / 2 ? ('done' as const) : ('active' as const) })) }],
            metrics: [{ label: '进程数', value: procs.length }],
          });
        }
        const lines = procs.length * prints;
        specs.push({
          type: 'PRINT',
          narration: prints + ' 条打印语句由 ' + procs.length + ' 个进程各执行一次，共输出 ' + lines + ' 行',
          views: [{ kind: 'fields', label: '输出', items: [{ text: String(lines), sub: '总行数' }] }],
          metrics: [{ label: '输出行数', value: lines }],
        });
        specs.push({
          type: 'DONE',
          narration: '2^' + n + ' = ' + procs.length + ' 个进程，' + procs.length + ' × ' + prints + ' = ' + lines + ' 行输出',
          views: [{ kind: 'chips', label: '结论', items: [{ text: procs.length + ' 个进程', state: 'done' as const }, { text: lines + ' 行输出', state: 'done' as const }] }],
          metrics: [{ label: '进程数', value: procs.length }, { label: '输出行数', value: lines }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 3. 哲学家就餐 ----------
const philosophers: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.dining", "os", "哲学家就餐", { n: "5", strategy: "none" });
  const FIELDS = [
    { key: 'n', label: '哲学家人数', type: 'number' as const, min: 2, max: 6 },
    { key: 'strategy', label: '策略', type: 'select' as const, options: [
      { value: 'none', label: '每人先拿左手筷' },
      { value: 'limit', label: '最多允许 n−1 人上桌' },
      { value: 'async', label: '奇数号先拿右手筷' },
    ] }];
  return {
    meta,
    summary: '所有人都先拿左手筷时，最后一根筷子永远等不到。',
    takeaway: '死锁的环路等待可以靠「限制上桌人数」或「打破拿筷顺序」消除。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '经典死锁', patch: { n: '5', strategy: 'none' } },
      { label: '限制上桌', patch: { n: '5', strategy: 'limit' } },
      { label: '奇偶分序', patch: { n: '5', strategy: 'async' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.n), strategy = String(inp.strategy);
      const issues: any[] = [];
      if (!(n >= 2 && n <= 6)) issues.push(bad('n', '人数取 2 到 6'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        // owner[j] = 拿着筷子 j 的哲学家编号；-1 表示空闲
        const owner = new Array<number>(n).fill(-1);
        const holds = new Array<number>(n).fill(0); // 每人手里几根
        const seated = new Array<boolean>(n).fill(true);
        if (strategy === 'limit') seated[n - 1] = false;
        const order = (i: number): [number, number] => {
          const left = i, right = (i + 1) % n;
          if (strategy === 'async' && i % 2 === 1) return [right, left];
          return [left, right];
        };
        const view = (last: number) => ({
          kind: 'chips' as const, label: '筷子归属',
          items: owner.map((o, j) => ({ text: '筷' + j, sub: o >= 0 ? 'p' + o : '空', state: o >= 0 ? ('active' as const) : j === last ? ('done' as const) : ('idle' as const) })),
        });
        specs.push({ type: 'INIT', narration: n + ' 位哲学家、' + n + ' 根筷子：筷 i 在 p_i 左手边' + (strategy === 'limit' ? '；最多 ' + (n - 1) + ' 人同时上桌' : strategy === 'async' ? '；奇数号先拿右手筷' : ''), views: [view(-1)] });
        let ate = 0, starved = 0;
        for (let round = 0; round < n + 1 && ate < n; round++) {
          for (let i = 0; i < n; i++) {
            if (!seated[i] || holds[i] === 2) continue;
            if (holds[i] === 0) {
              const [first] = order(i);
              if (owner[first] === -1) { owner[first] = i; holds[i] = 1; specs.push({ type: 'TAKE', narration: '第 ' + (round + 1) + ' 轮 p' + i + ' 拿起' + (first === i ? '左' : '右') + '手筷 ' + first, views: [view(first)], metrics: [{ label: '就餐人数', value: ate }, { label: '等待人数', value: starved }] }); }
              else { starved++; specs.push({ type: 'WAIT', narration: '第 ' + (round + 1) + ' 轮 p' + i + ' 想拿筷 ' + first + '，已被 p' + owner[first] + ' 拿走', views: [view(-1)], metrics: [{ label: '就餐人数', value: ate }, { label: '等待人数', value: starved }] }); }
            } else {
              const [, second] = order(i);
              const myFirst = owner.indexOf(i);
              if (myFirst < 0) continue;
              if (myFirst === second) continue;
              if (owner[second] === -1) {
                owner[second] = i; holds[i] = 2; ate++;
                specs.push({ type: 'EAT', narration: '第 ' + (round + 1) + ' 轮 p' + i + ' 凑齐两根筷子，就餐后放下', views: [view(second)], metrics: [{ label: '就餐人数', value: ate }, { label: '等待人数', value: starved }] });
                owner[myFirst] = -1; owner[second] = -1; holds[i] = 0;
              } else {
                starved++;
                specs.push({ type: 'BLOCK', narration: '第 ' + (round + 1) + ' 轮 p' + i + ' 手持筷 ' + myFirst + '，等 p' + owner[second] + ' 手里的筷 ' + second, views: [view(-1)], metrics: [{ label: '就餐人数', value: ate }, { label: '等待人数', value: starved }] });
              }
            }
          }
        }
        const stuck = ate === 0 && owner.every((o) => o >= 0);
        specs.push({
          type: 'DONE',
          narration: stuck
            ? '所有人各持一根、互相等待对方那根——环路等待形成，死锁'
            : strategy === 'limit'
              ? '有人拿不到第二根筷子时先放下已拿的并离桌，资源不占有，环路等待被切断'
              : strategy === 'async'
                ? '奇数号反向拿筷打乱了顺序，出现 p' + ate + ' 之前先有人凑齐两根'
                : '共 ' + ate + ' 人就餐',
          views: [{ kind: 'chips', label: '结局', items: [{ text: stuck ? '死锁' : '可推进', sub: stuck ? '环路等待' : '就餐 ' + ate + ' 人', state: stuck ? ('bad' as const) : ('done' as const) }] }],
          metrics: [{ label: '就餐人数', value: ate }, { label: '等待次数', value: starved }, { label: '死锁', value: stuck ? '是' : '否' }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();


// ---------- 4. 最少资源防死锁 ----------
const minResources: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.min-resources", "os", "最少资源防死锁", { procs: "3", need: "4" });
  const FIELDS = [
    { key: 'procs', label: '进程数 n', type: 'number' as const, min: 2, max: 10 },
    { key: 'need', label: '每进程最大同类资源需求 k', type: 'number' as const, min: 2, max: 10 },
  ];
  return {
    meta,
    summary: '最坏情况人人手持 k−1 只差 1：再多给 1 个就能打破僵局。',
    takeaway: '不死锁的最小资源数 = n×(k−1)+1；少一个就可能全员卡住。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { procs: '3', need: '4' } },
      { label: '5 进程各需 2', patch: { procs: '5', need: '2' } },
      { label: '4 进程各需 5', patch: { procs: '4', need: '5' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.procs), k = Number(inp.need);
      const issues: any[] = [];
      if (!(n >= 2 && k >= 2)) issues.push(bad('procs', '进程数和每进程需求都要至少 2'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const worst = n * (k - 1);
        const min = worst + 1;
        specs.push({
          type: 'INIT',
          narration: n + ' 个进程竞争同类资源，每个最多需要 ' + k + ' 个',
          views: [{ kind: 'fields', label: '参数', items: [{ text: String(n), sub: '进程数 n' }, { text: String(k), sub: '最大需求 k' }] }],
        });
        specs.push({
          type: 'WORST',
          narration: '最坏情况：每个进程都拿到 k−1=' + (k - 1) + ' 个，手里共 ' + worst + ' 个，人人都还差 1 个',
          views: [{ kind: 'bars', label: '各进程已持有', max: k, items: [...Array(n).keys()].map((i) => ({ label: 'p' + i, value: k - 1, state: 'warn' as const })) }],
          metrics: [{ label: '已分配总数', value: worst }],
        });
        specs.push({
          type: 'PLUS',
          narration: '资源总数只有 ' + worst + ' 时正好卡死；再多 1 个（共 ' + min + '），就能让某个进程先拿满并释放全部',
          views: [{ kind: 'chips', label: '关键一步', items: [{ text: worst + ' 个', sub: '可能死锁', state: 'bad' as const }, { text: min + ' 个', sub: '必不死锁', state: 'done' as const }] }],
          metrics: [{ label: '死锁上限', value: worst }],
        });
        specs.push({
          type: 'DONE',
          narration: '不死锁的最小资源数 = n×(k−1)+1 = ' + n + '×' + (k - 1) + '+1 = ' + min,
          views: [{ kind: 'fields', label: '结论', items: [{ text: String(min), sub: '最小资源数', state: 'done' as const }] }],
          metrics: [{ label: '最小资源数', value: min }, { label: '死锁临界', value: worst }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 5. i 节点最大文件长度 ----------
const inodeSize: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.inode-size", "os", "i 节点最大文件", { blockK: "1", addr: "4", direct: "10", levels: "3" });
  const FIELDS = [
    { key: 'blockK', label: '块大小（KB）', type: 'number' as const, min: 1, max: 8 },
    { key: 'addr', label: '块号地址长度（字节）', type: 'number' as const, min: 2, max: 8 },
    { key: 'direct', label: '直接指针个数', type: 'number' as const, min: 1, max: 15 },
    { key: 'levels', label: '间接级数（1/2/3）', type: 'number' as const, min: 1, max: 3 },
  ];
  return {
    meta,
    summary: '直接块 + 一级/二级/三级间接：每加一级，容量乘一个指针数。',
    takeaway: '每块指针数 = 块大小 ÷ 地址长度；最大文件 = (直接 + P + P² + P³) × 块大小。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { blockK: '1', addr: '4', direct: '10', levels: '3' } },
      { label: '4KB 块', patch: { blockK: '4', addr: '4', direct: '12', levels: '3' } },
      { label: '只有一级间接', patch: { blockK: '1', addr: '4', direct: '10', levels: '1' } },
    ],
    simulate(inp: any) {
      const blockK = Number(inp.blockK), addr = Number(inp.addr), direct = Number(inp.direct), levels = Number(inp.levels);
      const issues: any[] = [];
      if (!(blockK > 0 && addr > 0 && direct > 0)) issues.push(bad('blockK', '块大小、地址长度、直接指针数都要为正'));
      const specs: FrameSpec[] = [];
      const P = (blockK * 1024) / addr;
      if (!Number.isInteger(P)) issues.push(bad('addr', '块大小要能被地址长度整除'));
      if (!issues.some((i) => i.severity === 'error')) {
        const parts: [string, number][] = [['直接块', direct]];
        for (let lv = 1; lv <= levels; lv++) parts.push([lv + ' 级间接', Math.pow(P, lv)]);
        const blocks = parts.reduce((acc, [, b]) => acc + b, 0);
        const kb = blocks * blockK;
        specs.push({
          type: 'INIT',
          narration: '块大小 ' + blockK + 'KB，块号 ' + addr + ' 字节 → 每块可放 ' + P + ' 个指针',
          views: [{ kind: 'fields', label: '参数', items: [{ text: blockK + ' KB', sub: '块大小' }, { text: String(P), sub: '每块指针数 P' }, { text: String(direct), sub: '直接指针' }] }],
          metrics: [{ label: '每块指针数', value: P }],
        });
        let acc = 0;
        for (const [name, b] of parts) {
          acc += b;
          specs.push({
            type: 'LEVEL',
            narration: name + '：' + b + ' 块（累计 ' + acc + ' 块 = ' + (acc * blockK).toLocaleString("zh-CN") + ' KB）',
            views: [{ kind: 'bars', label: '各层块数', max: Math.max(...parts.map((x) => x[1])), items: parts.map(([nm, bb]) => ({ label: nm, value: bb, state: nm === name ? ('done' as const) : ('idle' as const) })) }],
            metrics: [{ label: '累计块数', value: acc }],
          });
        }
        const human = kb >= 1024 * 1024 ? (kb / 1024 / 1024).toFixed(2) + ' GB' : kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb + ' KB';
        specs.push({
          type: 'DONE',
          narration: '最大文件 = ' + blocks + ' 块 × ' + blockK + 'KB = ' + human,
          views: [{ kind: 'fields', label: '结论', items: [{ text: String(blocks), sub: '总块数' }, { text: human, sub: '最大文件长度', state: 'done' as const }] }],
          metrics: [{ label: '总块数', value: blocks }, { label: '最大KB', value: kb }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 6. CIDR 路由聚合 ----------
const cidrSum: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.cidr-sum", "net", "CIDR 路由聚合", { nets: "192.168.0.0,192.168.1.0,192.168.2.0,192.168.3.0", mask: "24" });
  const FIELDS = [{ key: 'nets', label: '网络地址列表（逗号分隔）', type: 'text' as const, placeholder: '192.168.0.0,192.168.1.0' }, { key: 'mask', label: '各自前缀长度', type: 'number' as const, min: 8, max: 30 }];
  return {
    meta,
    summary: '把相邻网络写成二进制，找最长公共前缀，就是聚合后的路由。',
    takeaway: '聚合 = 公共前缀变短；聚合块必须刚好圈住这些网络，不能把别人的地址也包含进来。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '四网聚一', patch: { nets: '192.168.0.0,192.168.1.0,192.168.2.0,192.168.3.0', mask: '24' } },
      { label: '两个聚一', patch: { nets: '172.16.4.0,172.16.5.0', mask: '24' } },
      { label: '八网聚一', patch: { nets: '10.0.0.0,10.0.1.0,10.0.2.0,10.0.3.0,10.0.4.0,10.0.5.0,10.0.6.0,10.0.7.0', mask: '24' } },
    ],
    simulate(inp: any) {
      const list = String(inp.nets).split(/[,，\s]+/).filter(Boolean);
      const mask = Number(inp.mask);
      const issues: any[] = [];
      const octs = list.map((x) => x.split('.').map(Number));
      if (list.length < 2) issues.push(bad('nets', '至少 2 个网络地址'));
      if (octs.some((o) => o.length !== 4 || o.some((v) => !(v >= 0 && v <= 255)))) issues.push(bad('nets', '每个地址要写成 a.b.c.d 四段'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const to32 = (o: number[]) => (((o[0]! << 24) | (o[1]! << 16) | (o[2]! << 8) | o[3]!) >>> 0);
        const vals = octs.map(to32);
        const bits = (v: number) => v.toString(2).padStart(32, '0');
        const fmt = (v: number) => [((v >>> 24) & 255), ((v >>> 16) & 255), ((v >>> 8) & 255), (v & 255)].join('.');
        specs.push({
          type: 'INIT',
          narration: list.length + ' 个 /' + mask + ' 网络：' + list.join('、'),
          views: [{ kind: 'fields', label: '后 16 位二进制', items: vals.map((v, i) => ({ text: bits(v).slice(16), sub: list[i]! })) }],
        });
        let common = 32;
        for (let b = 0; b < 32; b++) {
          const bit = (vals[0]! >>> (31 - b)) & 1;
          if (vals.some((v) => ((v >>> (31 - b)) & 1) !== bit)) { common = b; break; }
        }
        const prefix = Math.max(common, 8);
        const base = ((vals[0]! >>> (32 - prefix)) << (32 - prefix)) >>> 0;
        const cover = Math.pow(2, 32 - prefix);
        const need = vals.length * Math.pow(2, 32 - mask);
        const aligned = cover >= need && vals.every((v) => v >= base && v < base + cover);
        specs.push({
          type: 'PREFIX',
          narration: '逐位比较得到最长公共前缀 ' + prefix + ' 位，聚合块覆盖 ' + cover + ' 个地址' + (aligned ? '，刚好圈住这 ' + vals.length + ' 个网络' : '，与这些网络的范围不匹配'),
          views: [{ kind: 'fields', label: '公共前缀', items: [{ text: bits(base), sub: '前 ' + prefix + ' 位相同' }, { text: String(cover), sub: '块内地址数' }] }],
          metrics: [{ label: '公共前缀', value: prefix }],
        });
        specs.push({
          type: 'DONE',
          narration: aligned ? '聚合路由：' + fmt(base) + '/' + prefix + '，' + vals.length + ' 条并成 1 条' : '不能安全聚合：保持原来的 ' + vals.length + ' 条路由',
          views: [{ kind: 'chips', label: '结果', items: [{ text: aligned ? fmt(base) + '/' + prefix : '不可聚合', state: aligned ? ('done' as const) : ('warn' as const) }] }],
          metrics: [{ label: '聚合前缀', value: aligned ? prefix : 0 }, { label: '路由条数', value: aligned ? 1 : vals.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 7. 跨网段通信 IP/MAC ----------
const ipMac: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.ip-mac", "net", "跨网段 IP 与 MAC", { same: "no" });
  const FIELDS = [{ key: 'same', label: '收发双方是否同网段', type: 'select' as const, options: [{ value: 'yes', label: '同一网段' }, { value: 'no', label: '跨网段（经路由器）' }] }];
  return {
    meta,
    summary: 'IP 地址端到端不变；MAC 每一跳都换成下一跳的硬件地址。',
    takeaway: '跨网段时源主机把帧发给网关 MAC，目的 IP 仍是最终主机——逐跳交付、端到端寻址。',
    fields: FIELDS,
    defaultInput: input,
    presets: [{ label: '同一网段', patch: { same: 'yes' } }, { label: '跨网段', patch: { same: 'no' } }],
    simulate(inp: any) {
      const same = inp.same === 'yes';
      const A_MAC = 'AA:AA:01', B_MAC = 'BB:BB:02', GW_IN = 'GW:IN:00', GW_OUT = 'GW:OUT:01';
      const A_IP = '192.168.1.10', B_IP = '10.0.0.20', GW_IP = '192.168.1.1';
      const specs: FrameSpec[] = [];
      const hop = (label: string, smac: string, dmac: string, note: string) => {
        specs.push({
          type: 'HOP',
          narration: label + '：' + note,
          views: [{ kind: 'fields', label: label, items: [
            { text: smac, sub: '源 MAC', state: 'active' as const },
            { text: dmac, sub: '目的 MAC', state: 'done' as const },
            { text: A_IP, sub: '源 IP（全程不变）' },
            { text: B_IP, sub: '目的 IP（全程不变）' },
          ] }],
        });
      };
      specs.push({
        type: 'INIT',
        narration: 'A（' + A_IP + '，MAC ' + A_MAC + '）要发送数据' + (same ? '给同网段的 B' : '给跨网段的 B（' + B_IP + '）'),
        views: [{ kind: 'chips', label: 'A 的判断', items: [{ text: same ? '同网段：ARP 找 B' : '跨网段：ARP 找网关 ' + GW_IP, sub: '比较网络号得出', state: same ? ('done' as const) : ('warn' as const) }] }],
      });
      if (same) {
        hop('帧 1：A → B', A_MAC, B_MAC, 'ARP 解析出 B 的 MAC，直接交付');
        specs.push({
          type: 'DONE',
          narration: '一跳直达：目的 MAC 就是 B 的 ' + B_MAC,
          views: [{ kind: 'chips', label: '结论', items: [{ text: '1 跳', sub: 'MAC 不换', state: 'done' as const }] }],
          metrics: [{ label: '跳数', value: 1 }, { label: 'MAC 更换次数', value: 0 }],
        });
      } else {
        hop('帧 1：A → 网关', A_MAC, GW_IN, 'A 把目的 MAC 写成网关入口，目的 IP 仍是 B');
        hop('帧 2：网关 → B', GW_OUT, B_MAC, '路由器查路由表从出口转发，源 MAC 换成出口地址');
        specs.push({
          type: 'DONE',
          narration: 'IP 全程 ' + A_IP + ' → ' + B_IP + ' 不变，MAC 换了两轮：这就是网络层与链路层的分工',
          views: [{ kind: 'chips', label: '结论', items: [{ text: 'IP 端到端不变', state: 'done' as const }, { text: 'MAC 逐跳更换', state: 'active' as const }] }],
          metrics: [{ label: '跳数', value: 2 }, { label: 'MAC 更换次数', value: 2 }],
        });
      }
      return buildSimulation(meta, inp, specs, []);
    },
  };
})();

// ---------- 8. 时延带宽积与停等利用率 ----------
const linkUtil: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.link-util", "net", "时延带宽积与利用率", { len: "1000", bw: "1", rt: "200" });
  const FIELDS = [
    { key: 'len', label: '帧长（bit）', type: 'number' as const, min: 100, max: 100000 },
    { key: 'bw', label: '带宽（Mbps）', type: 'number' as const, min: 1, max: 1000 },
    { key: 'rt', label: '单程传播时延（μs）', type: 'number' as const, min: 1, max: 100000 },
  ];
  return {
    meta,
    summary: '时延带宽积 = 传播时延 × 带宽，表示链路里能「装」多少 bit。',
    takeaway: '停等利用率 = 发送时延 ÷（发送时延 + 2×传播时延）：距离远、帧短就浪费。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { len: '1000', bw: '1', rt: '200' } },
      { label: '高带宽浪费大', patch: { len: '1000', bw: '100', rt: '200' } },
      { label: '长帧拉高利用率', patch: { len: '20000', bw: '1', rt: '200' } },
    ],
    simulate(inp: any) {
      const len = Number(inp.len), bw = Number(inp.bw), rt = Number(inp.rt);
      const issues: any[] = [];
      if (!(len > 0 && bw > 0 && rt > 0)) issues.push(bad('len', '帧长、带宽、时延都要为正数'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const tSend = (len / (bw * 1e6)) * 1e6;
        const pip = rt * bw;
        const total = tSend + 2 * rt;
        const util = tSend / total;
        specs.push({
          type: 'INIT',
          narration: '帧长 ' + len + ' bit，带宽 ' + bw + ' Mbps，单程传播时延 ' + rt + ' μs',
          views: [{ kind: 'fields', label: '参数', items: [{ text: len + ' bit', sub: '帧长' }, { text: bw + ' Mbps', sub: '带宽' }, { text: rt + ' μs', sub: '单程时延' }] }],
        });
        specs.push({
          type: 'SEND',
          narration: '发送时延 = ' + len + ' ÷ (' + bw + '×10⁶) = ' + tSend.toFixed(2) + ' μs',
          views: [{ kind: 'timeline', label: '一个停等周期', span: Math.ceil(total), segments: [
            { start: 0, end: tSend, label: '发送', state: 'active' as const },
            { start: tSend, end: tSend + rt, label: '传播→', state: 'done' as const },
            { start: tSend + rt, end: total, label: 'ACK←', state: 'warn' as const },
          ] }],
          metrics: [{ label: '发送时延', value: Number(tSend.toFixed(2)) }, { label: '周期', value: Number(total.toFixed(2)) }],
        });
        specs.push({
          type: 'PIPE',
          narration: '时延带宽积 = ' + rt + ' μs × ' + bw + ' Mbps = ' + pip.toFixed(0) + ' bit：第一个 bit 到达时链路上已发出这么多',
          views: [{ kind: 'fields', label: '时延带宽积', items: [{ text: pip.toFixed(0) + ' bit', sub: '链路容量', state: 'done' as const }, { text: len + ' bit', sub: '帧长（对比）' }] }],
          metrics: [{ label: '时延带宽积', value: Number(pip.toFixed(0)) }],
        });
        specs.push({
          type: 'DONE',
          narration: '停等利用率 = ' + tSend.toFixed(2) + ' ÷ ' + total.toFixed(2) + ' = ' + (util * 100).toFixed(1) + '%',
          views: [{ kind: 'bars', label: '周期构成（μs）', max: Math.ceil(total), items: [
            { label: '有效发送', value: Number(tSend.toFixed(2)), state: 'done' as const },
            { label: '往返传播', value: Number((2 * rt).toFixed(2)), state: 'warn' as const },
          ] }],
          metrics: [{ label: '利用率百分比', value: Number((util * 100).toFixed(1)) }, { label: '周期微秒', value: Number(total.toFixed(2)) }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

export const batch13 = { booth, forkCount, philosophers, minResources, inodeSize, cidrSum, ipMac, linkUtil } as const;
