import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

/**
 * 第十五批：CPU 数据通路寄存器、高响应比优先、工作集、SPOOLing、
 * 多级目录按名存取、HTTP 持久连接、TCP/UDP 首部对比、交换机自学习。
 */

// ---------- 1. CPU 内部寄存器与数据通路 ----------
const datapathRegs: GenericModuleDef<any> = (() => {
  const { meta, input } = M("co.datapath-regs", "co", "CPU 寄存器数据通路", { instr: "load" });
  const FIELDS = [{ key: 'instr', label: '指令', type: 'select' as const, options: [{ value: 'load', label: 'LOAD x（取数到 ACC）' }, { value: 'add', label: 'ADD x（ACC 加内存字' }] }];
  return {
    meta,
    summary: 'MAR 存地址、MDR 存数据：访存必经这对寄存器。',
    takeaway: 'PC→MAR 发地址，存储器→MDR 收数据，MDR→IR 或 ACC；用户不能直接访问 MAR/MDR。',
    fields: FIELDS,
    defaultInput: input,
    presets: [{ label: 'LOAD', patch: { instr: 'load' } }, { label: 'ADD', patch: { instr: 'add' } }],
    simulate(inp: any) {
      const instr = String(inp.instr);
      const PLAN: Record<string, [string, string, string][]> = {
        load: [
          ['PC', '1000', '取指开始：PC 内容送 MAR'],
          ['MAR', '1000', 'MAR 经地址总线选中存储单元'],
          ['MDR', '0521', '读出的指令字进入 MDR'],
          ['IR', '0521', 'MDR 送 IR 并译码：LOAD 2000'],
          ['MAR', '2000', '指令地址码 2000 送 MAR（执行周期）'],
          ['MDR', '0037', '数据字 0037 从主存读入 MDR'],
          ['ACC', '0037', 'MDR 送累加器 ACC，指令结束'],
        ],
        add: [
          ['PC', '1000', 'PC 送 MAR'],
          ['MDR', '0A00', '指令经 MDR 取回'],
          ['IR', '0A00', 'IR 译码：ADD 2001'],
          ['MAR', '2001', '地址码送 MAR'],
          ['MDR', '0005', '操作数读入 MDR'],
          ['ACC', '003C', 'ACC(0037)+MDR(0005)=003C 写回 ACC'],
        ],
      };
      const plan = PLAN[instr];
      const issues = plan ? [] : [bad('instr', '可选 load / add')];
      const specs: FrameSpec[] = [];
      if (plan) {
        const regs = ['PC', 'MAR', 'MDR', 'IR', 'ACC'];
        const state = new Map<string, string>();
        specs.push({
          type: 'INIT',
          narration: '一条 ' + instr.toUpperCase() + ' 指令在寄存器之间怎么走（PC=1000，ACC=0037）',
          views: [{ kind: 'fields', label: '寄存器初值', items: [{ text: '1000', sub: 'PC' }, { text: '—', sub: 'MAR' }, { text: '—', sub: 'MDR' }, { text: '—', sub: 'IR' }, { text: '0037', sub: 'ACC' }] }],
        });
        plan.forEach(([reg, val, note], i) => {
          state.set(reg, val);
          specs.push({
            type: 'FLOW',
            narration: (i + 1) + '. ' + reg + ' ← ' + val + '：' + note,
            views: [{ kind: 'fields', label: '寄存器当前值', items: regs.map((r) => ({ text: state.get(r) ?? '—', sub: r, state: r === reg ? ('active' as const) : ('idle' as const) })) }],
            metrics: [{ label: '第几步', value: i + 1 }, { label: '涉及寄存器', value: reg }],
          });
        });
        specs.push({
          type: 'DONE',
          narration: plan.length + ' 次寄存器传送完成；MAR 宽度 = 地址位数，MDR 宽度 = 存储字长',
          views: [{ kind: 'chips', label: '关键结论', items: [{ text: '访存必经 MAR/MDR', state: 'done' as const }, { text: '用户不可见', sub: 'MAR/MDR/IR', state: 'done' as const }] }],
          metrics: [{ label: '传送次数', value: plan.length }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 2. 高响应比优先 HRRN ----------
const hrrn: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.hrrn", "os", "高响应比优先调度", { procs: "P1,0,8;P2,2,4;P3,4,1" });
  const FIELDS = [{ key: 'procs', label: '进程（名字,到达,服务时间；分号分隔）', type: 'text' as const, placeholder: 'P1,0,8;P2,2,4' }];
  return {
    meta,
    summary: '每次挑响应比最高的：Rp = (等待 + 服务) / 服务。',
    takeaway: 'HRRN 是 SJF 与 FCFS 的折中：短作业占优，长作业等久了响应比也会爬上来。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { procs: 'P1,0,8;P2,2,4;P3,4,1' } },
      { label: '长作业先到', patch: { procs: 'P1,0,10;P2,1,1;P3,2,1' } },
    ],
    simulate(inp: any) {
      const procs = String(inp.procs).split(/[;，]/).map((s) => s.split(/[,，\s]+/).filter(Boolean)).filter((a) => a.length === 3).map((a) => ({ name: a[0]!, arrive: Number(a[1]), burst: Number(a[2]) }));
      const issues: any[] = [];
      if (procs.length < 2) issues.push(bad('procs', '至少 2 个进程（名字,到达,服务）'));
      if (procs.some((x) => !(x.burst > 0))) issues.push(bad('procs', '服务时间必须为正'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const pool = [...procs].sort((a, b) => a.arrive - b.arrive);
        const ready: typeof pool = [];
        const done: { name: string; turn: number; start: number; end: number }[] = [];
        let now = 0, step = 0;
        specs.push({ type: 'INIT', narration: procs.length + ' 个进程：' + procs.map((x) => x.name + '(到' + x.arrive + ',跑' + x.burst + ')').join(' '), views: [{ kind: 'fields', label: '进程', items: procs.map((x) => ({ text: '到 ' + x.arrive + ' / 跑 ' + x.burst, sub: x.name })) }] });
        while (pool.length || ready.length) {
          while (pool.length && pool[0]!.arrive <= now) ready.push(pool.shift()!);
          if (!ready.length) { now = pool[0]!.arrive; continue; }
          const scored = ready.map((x) => ({ x, rp: (now - x.arrive + x.burst) / x.burst })).sort((a, b) => b.rp - a.rp);
          const pick = scored[0]!;
          step++;
          specs.push({
            type: 'PICK',
            narration: 't=' + now + ' 候选响应比：' + scored.map((s) => s.x.name + '=' + s.rp.toFixed(2)).join('，') + ' → 选 ' + pick.x.name,
            views: [
              { kind: 'bars', label: '响应比', max: Math.max(...scored.map((s) => s.rp), 1), items: scored.map((s) => ({ label: s.x.name, value: Number(s.rp.toFixed(2)), state: s.x.name === pick.x.name ? ('done' as const) : ('idle' as const) })) },
              { kind: 'timeline', label: '甘特图', span: now + pick.x.burst, segments: [...done.map((d, i) => ({ start: d.start, end: d.end, label: d.name, state: 'done' as const })), { start: now, end: now + pick.x.burst, label: pick.x.name, state: 'active' as const }] },
            ],
            metrics: [{ label: '选中', value: pick.x.name }, { label: '响应比', value: Number(pick.rp.toFixed(2)) }],
          });
          ready.splice(ready.indexOf(pick.x), 1);
          done.push({ name: pick.x.name, turn: now + pick.x.burst - pick.x.arrive, start: now, end: now + pick.x.burst });
          now += pick.x.burst;
        }
        const avg = done.reduce((acc, d) => acc + d.turn, 0) / done.length;
        specs.push({
          type: 'DONE',
          narration: '执行顺序 ' + done.map((d) => d.name).join('→') + '，平均周转时间 ' + avg.toFixed(2),
          views: [{ kind: 'matrix', label: '周转时间', columns: ['到达', '服务', '完成', '周转'], rowHeaders: done.map((d) => d.name), rows: done.map((d) => { const o = procs.find((x) => x.name === d.name)!; return [o.arrive, o.burst, d.end, d.turn]; }) }],
          metrics: [{ label: '平均周转', value: Number(avg.toFixed(2)) }, { label: '顺序', value: done.map((d) => d.name).join('') }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 3. 工作集窗口 ----------
const workingSet: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.working-set", "os", "工作集与窗口", { refs: "1,2,1,3,1,2,4,1,2,3", delta: "3" });
  const FIELDS = [
    { key: 'refs', label: '页引用串（逗号分隔）', type: 'text' as const, placeholder: '1,2,1,3' },
    { key: 'delta', label: '窗口大小 Δ（最近几次引用）', type: 'number' as const, min: 2, max: 6 },
  ];
  return {
    meta,
    summary: '工作集 = 最近 Δ 次引用里出现过的页的集合。',
    takeaway: '分配给进程的物理页框数要 ≥ 当前工作集，否则立刻陷入颠簸。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { refs: '1,2,1,3,1,2,4,1,2,3', delta: '3' } },
      { label: '窗口放大', patch: { refs: '1,2,1,3,1,2,4,1,2,3', delta: '5' } },
    ],
    simulate(inp: any) {
      const refs = String(inp.refs).split(/[,，\s]+/).filter(Boolean).map(Number);
      const D = Number(inp.delta);
      const issues: any[] = [];
      if (refs.length < 3) issues.push(bad('refs', '引用串至少 3 个页号'));
      if (!(D >= 2 && D <= 6)) issues.push(bad('delta', '窗口 Δ 取 2 到 6'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        specs.push({ type: 'INIT', narration: '引用串 ' + refs.join(',') + '，窗口 Δ=' + D, views: [{ kind: 'chips', label: '引用串', items: refs.map((x) => ({ text: String(x), state: 'idle' as const })) }] });
        const sizes: number[] = [];
        refs.forEach((_, i) => {
          const win = refs.slice(Math.max(0, i - D + 1), i + 1);
          const set = [...new Set(win)].sort((a, b) => a - b);
          sizes.push(set.length);
          specs.push({
            type: 'WS',
            narration: 't=' + (i + 1) + ' 窗口 [' + win.join(',') + '] → 工作集 {' + set.join(',') + '}，大小 ' + set.length,
            views: [
              { kind: 'chips', label: '引用串（窗口高亮）', items: refs.map((x, k) => ({ text: String(x), state: k > i ? ('idle' as const) : k >= Math.max(0, i - D + 1) && k <= i ? (k === i ? ('active' as const) : ('done' as const)) : ('idle' as const) })) },
              { kind: 'fields', label: '当前工作集', items: set.map((x) => ({ text: String(x), state: 'done' as const })) },
            ],
            metrics: [{ label: '工作集大小', value: set.length }],
          });
        });
        const max = Math.max(...sizes);
        specs.push({
          type: 'DONE',
          narration: '工作集峰值 ' + max + '：物理页框至少要 ' + max + ' 个才不颠簸',
          views: [{ kind: 'bars', label: '各时刻工作集大小', max, items: sizes.map((v, i) => ({ label: 't' + (i + 1), value: v, state: v === max ? ('warn' as const) : ('done' as const) })) }],
          metrics: [{ label: '峰值', value: max }, { label: '平均', value: Number((sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2)) }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 4. SPOOLing 假脱机 ----------
const spooling: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.spooling", "os", "SPOOLing 假脱机", { jobs: "3", gen: "2", io: "10" });
  const FIELDS = [
    { key: 'jobs', label: '作业数', type: 'number' as const, min: 1, max: 6 },
    { key: 'gen', label: '每作业生成数据耗时（时间单位）', type: 'number' as const, min: 1, max: 10 },
    { key: 'io', label: '每作业慢速打印耗时（时间单位）', type: 'number' as const, min: 2, max: 30 },
  ];
  return {
    meta,
    summary: '把独占设备虚拟成共享：先写输入井/输出井，后台慢慢打印。',
    takeaway: 'SPOOLing 用空间换时间：作业不再霸占打印机，CPU 与 I/O 重叠。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '3 个作业', patch: { jobs: '3', gen: '2', io: '10' } },
      { label: '打印更慢', patch: { jobs: '4', gen: '1', io: '20' } },
    ],
    simulate(inp: any) {
      const n = Number(inp.jobs), gen = Number(inp.gen), io = Number(inp.io);
      const issues: any[] = [];
      if (!(n >= 1 && gen > 0 && io > 0)) issues.push(bad('jobs', '作业数与耗时要为正'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const direct = n * (gen + io);
        const spool = Math.max(n * gen, gen + n * io);
        specs.push({
          type: 'INIT',
          narration: n + ' 个作业，各生成 ' + gen + '、打印 ' + io,
          views: [{ kind: 'fields', label: '参数', items: [{ text: String(n), sub: '作业数' }, { text: String(gen), sub: '生成' }, { text: String(io), sub: '打印' }] }],
        });
        type Seg = { start: number; end: number; label: string; state: 'done' | 'warn' | 'active' };
        const directSegs: Seg[] = [];
        for (let i = 0; i < n; i++) { directSegs.push({ start: i * (gen + io), end: i * (gen + io) + gen, label: 'J' + (i + 1) + '生成', state: 'done' }); directSegs.push({ start: i * (gen + io) + gen, end: (i + 1) * (gen + io), label: 'J' + (i + 1) + '打印', state: 'warn' }); }
        const spoolSegs: Seg[] = [];
        for (let i = 0; i < n; i++) spoolSegs.push({ start: i * gen, end: (i + 1) * gen, label: 'J' + (i + 1) + '→井', state: 'done' });
        spoolSegs.push({ start: Math.min(gen, spool), end: Math.min(gen + n * io, spool), label: '后台打印', state: 'active' });
        specs.push({
          type: 'DIRECT',
          narration: '直接打印：每个作业独占打印机，总时间 = ' + n + '×(' + gen + '+' + io + ') = ' + direct,
          views: [{ kind: 'timeline', label: '直接方式', span: direct, segments: directSegs }],
          metrics: [{ label: '直接总时间', value: direct }],
        });
        specs.push({
          type: 'SPOOL',
          narration: 'SPOOLing：作业把输出写进输出井就继续跑，守护进程从第一个作业就绪后开始串行打印；总时间 = max(全部生成, 首作业完成 + 全部打印) = ' + spool,
          views: [{ kind: 'timeline', label: 'SPOOLing 方式', span: spool, segments: spoolSegs }],
          metrics: [{ label: 'SPOOL 总时间', value: spool }],
        });
        specs.push({
          type: 'DONE',
          narration: direct + ' → ' + spool + '，省下 ' + (direct - spool) + ' 个时间单位',
          views: [{ kind: 'bars', label: '总时间对比', max: direct, items: [{ label: '直接打印', value: direct, state: 'warn' as const }, { label: 'SPOOLing', value: spool, state: 'done' as const }] }],
          metrics: [{ label: '节省时间', value: direct - spool }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 5. 多级目录按名存取 ----------
const dirAccess: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.dir-access", "os", "多级目录按名存取", { path: "/usr/test/prog.c" });
  const FIELDS = [{ key: 'path', label: '绝对路径（斜杠分隔）', type: 'text' as const, placeholder: '/usr/test/prog.c' }];
  const TREE: Record<string, string[]> = {
    '/': ['usr', 'bin'],
    '/usr': ['test', 'include'],
    '/usr/test': ['prog.c', 'a.out'],
    '/usr/include': ['stdio.h'],
    '/bin': ['ls'],
  };
  return {
    meta,
    summary: '按名存取 = 从根目录起一级一级查目录项，拿到下一级磁盘块。',
    takeaway: '每解析一级目录就多一次磁盘访问；路径深度直接决定打开文件的开销。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '三级路径', patch: { path: '/usr/test/prog.c' } },
      { label: '一级路径', patch: { path: '/bin/ls' } },
    ],
    simulate(inp: any) {
      const path = String(inp.path);
      const parts = path.split('/').filter(Boolean);
      const issues: any[] = [];
      if (!path.startsWith('/') || parts.length === 0) issues.push(bad('path', '请写绝对路径，如 /usr/test/prog.c'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        let cur = '/';
        let diskReads = 0;
        specs.push({ type: 'INIT', narration: '从根目录 / 开始解析：' + parts.join(' → '), views: [{ kind: 'chips', label: '待解析', items: parts.map((x) => ({ text: x, state: 'idle' as const })) }] });
        for (let i = 0; i < parts.length; i++) {
          const name = parts[i]!;
          const parent = cur;
          const listing = TREE[parent] ?? [];
          diskReads++;
          const found = listing.includes(name);
          const isLast = i === parts.length - 1;
          if (found) cur = parent === '/' ? '/' + name : parent + '/' + name;
          specs.push({
            type: 'LOOKUP',
            narration: '访盘 ' + diskReads + '：读目录 ' + parent + '，查目录项 ' + name + ' → ' + (found ? (isLast ? '是文件，得到其 i 节点号' : '是子目录，进入 ' + cur) : '不存在'),
            views: [
              { kind: 'fields', label: '当前目录内容', items: listing.map((x) => ({ text: x, sub: x === name ? '命中' : '', state: x === name ? ('done' as const) : ('idle' as const) })) },
              { kind: 'chips', label: '解析进度', items: parts.map((x, j) => ({ text: x, state: j < i ? ('done' as const) : j === i ? ('active' as const) : ('idle' as const) })) },
            ],
            metrics: [{ label: '访盘次数', value: diskReads }, { label: '当前路径', value: cur }],
          });
          if (!found) break;
        }
        specs.push({
          type: 'DONE',
          narration: diskReads === parts.length ? '解析成功：' + diskReads + ' 次目录访盘，再读 1 次 i 节点即可打开文件' : '路径不存在：在第 ' + diskReads + ' 级目录里找不到该名字',
          views: [{ kind: 'fields', label: '结果', items: [{ text: String(diskReads), sub: '目录访盘' }, { text: diskReads === parts.length ? String(diskReads + 1) : '—', sub: '含 i 节点总次数' }] }],
          metrics: [{ label: '目录访盘次数', value: diskReads }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 6. HTTP 持久连接 ----------
const httpPersist: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.http-persist", "net", "HTTP 持久连接", { objs: "5", rtt: "100" });
  const FIELDS = [
    { key: 'objs', label: '页面对象数（含 HTML 本身）', type: 'number' as const, min: 1, max: 20 },
    { key: 'rtt', label: 'RTT（ms）', type: 'number' as const, min: 10, max: 500 },
  ];
  return {
    meta,
    summary: '非持久连接每个对象都要新建再关闭 TCP；持久连接复用同一条。',
    takeaway: '非持久每对象 2RTT + 传输；持久连接只在第一个对象上付 2RTT，其余 1RTT。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '教材例题', patch: { objs: '5', rtt: '100' } },
      { label: '单对象', patch: { objs: '1', rtt: '100' } },
    ],
    simulate(inp: any) {
      const objs = Number(inp.objs), rtt = Number(inp.rtt);
      const issues: any[] = [];
      if (!(objs >= 1 && objs <= 20)) issues.push(bad('objs', '对象数取 1 到 20'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const non = objs * 2 * rtt;
        const per = 2 * rtt + (objs - 1) * rtt;
        specs.push({
          type: 'INIT',
          narration: objs + ' 个对象，RTT=' + rtt + 'ms（传输时间忽略，408 常考口径）',
          views: [{ kind: 'fields', label: '参数', items: [{ text: String(objs), sub: '对象数' }, { text: rtt + ' ms', sub: 'RTT' }] }],
        });
        specs.push({
          type: 'NON',
          narration: '非持久：每对象 TCP 连接 1RTT + 请求响应 1RTT = 2RTT，共 ' + objs + '×2×' + rtt + ' = ' + non + ' ms',
          views: [{ kind: 'timeline', label: '非持久连接', span: non, segments: [...Array(objs).keys()].map((i) => ({ start: i * 2 * rtt, end: (i + 1) * 2 * rtt, label: '对象' + (i + 1), state: 'warn' as const })) }],
          metrics: [{ label: '非持久毫秒', value: non }],
        });
        type Seg = { start: number; end: number; label: string; state: 'done' | 'active' | 'warn' };
        const persistSegs: Seg[] = [{ start: 0, end: 2 * rtt, label: '建连+对象1', state: 'done' }];
        for (let i = 0; i < objs - 1; i++) persistSegs.push({ start: 2 * rtt + i * rtt, end: 2 * rtt + (i + 1) * rtt, label: '对象' + (i + 2), state: 'active' });
        specs.push({
          type: 'PERSIST',
          narration: '持久：首对象 2RTT（建连+请求），其余各 1RTT，共 2×' + rtt + ' + ' + (objs - 1) + '×' + rtt + ' = ' + per + ' ms',
          views: [{ kind: 'timeline', label: '持久连接', span: per, segments: persistSegs }],
          metrics: [{ label: '持久毫秒', value: per }],
        });
        specs.push({
          type: 'DONE',
          narration: non + ' ms → ' + per + ' ms，省了 ' + (non - per) + ' ms（' + ((1 - per / non) * 100).toFixed(0) + '%）',
          views: [{ kind: 'bars', label: '总时间对比（ms）', max: non, items: [{ label: '非持久', value: non, state: 'warn' as const }, { label: '持久', value: per, state: 'done' as const }] }],
          metrics: [{ label: '节省毫秒', value: non - per }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 7. TCP/UDP 首部对比 ----------
const tcpUdpHeader: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.tcp-udp-header", "net", "TCP 与 UDP 首部", { payload: "1000", segs: "3" });
  const FIELDS = [
    { key: 'payload', label: '应用层数据（字节）', type: 'number' as const, min: 10, max: 8000 },
    { key: 'segs', label: 'TCP 分段数', type: 'number' as const, min: 1, max: 10 },
  ];
  return {
    meta,
    summary: 'TCP 首部最少 20 字节、UDP 固定 8 字节；差在可靠性字段。',
    takeaway: 'TCP 用序号/确认/窗口换可靠，UDP 把开销压到 8 字节换低延迟。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '1000 字节 3 段', patch: { payload: '1000', segs: '3' } },
      { label: '单段小包', patch: { payload: '100', segs: '1' } },
    ],
    simulate(inp: any) {
      const payload = Number(inp.payload), segs = Number(inp.segs);
      const issues: any[] = [];
      if (!(payload >= 10 && segs >= 1)) issues.push(bad('payload', '数据至少 10 字节、分段数至少 1'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const tcpFields: [string, number][] = [['源/目的端口', 4], ['序号', 4], ['确认号', 4], ['数据偏移+标志', 2], ['窗口', 2], ['校验和+紧急指针', 4]];
        const udpFields: [string, number][] = [['源/目的端口', 4], ['长度', 2], ['校验和', 2]];
        specs.push({
          type: 'INIT',
          narration: '应用数据 ' + payload + ' 字节，TCP 分成 ' + segs + ' 段传输',
          views: [{ kind: 'fields', label: '场景', items: [{ text: payload + ' B', sub: '数据' }, { text: String(segs), sub: 'TCP 段数' }] }],
        });
        specs.push({
          type: 'TCP',
          narration: 'TCP 首部最少 20 字节：' + tcpFields.map(([nm, b]) => nm + '(' + b + ')').join(' + ') + '，每段都带序号与确认',
          views: [{ kind: 'matrix', label: 'TCP 首部字段', columns: ['字段', '字节'], rowHeaders: tcpFields.map(([nm]) => nm), rows: tcpFields.map(([nm, b]) => [nm, b]) }],
          metrics: [{ label: 'TCP 首部', value: 20 }],
        });
        specs.push({
          type: 'UDP',
          narration: 'UDP 首部固定 8 字节：' + udpFields.map(([nm, b]) => nm + '(' + b + ')').join(' + ') + '，没有序号/窗口',
          views: [{ kind: 'matrix', label: 'UDP 首部字段', columns: ['字段', '字节'], rowHeaders: udpFields.map(([nm]) => nm), rows: udpFields.map(([nm, b]) => [nm, b]) }],
          metrics: [{ label: 'UDP 首部', value: 8 }],
        });
        const tcpTotal = payload + segs * 20;
        const udpTotal = payload + 8;
        specs.push({
          type: 'DONE',
          narration: '线上字节：TCP ' + tcpTotal + '（' + segs + '×20 首部）vs UDP ' + udpTotal + '；多付 ' + (tcpTotal - udpTotal) + ' 字节买可靠性',
          views: [{ kind: 'bars', label: '总字节数', max: tcpTotal, items: [{ label: 'TCP', value: tcpTotal, state: 'warn' as const }, { label: 'UDP', value: udpTotal, state: 'done' as const }] }],
          metrics: [{ label: 'TCP 总字节', value: tcpTotal }, { label: 'UDP 总字节', value: udpTotal }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

// ---------- 8. 交换机自学习 ----------
const switchLearn: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.switch-learn", "net", "交换机自学习", { events: "A-in,H,B-in,H,A-in,D-in" });
  const FIELDS = [{ key: 'events', label: '帧事件（X-in=主机 X 发帧；H=目的未知/广播）', type: 'text' as const, placeholder: 'A-in,H,B-in,H' }];
  const HOSTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
  return {
    meta,
    summary: '收到帧就记下「源 MAC→端口」，转发时查表，查不到就泛洪。',
    takeaway: '自学习让表越用越全：目的已知就点对点，未知或广播就泛洪（入口除外）。',
    fields: FIELDS,
    defaultInput: input,
    presets: [
      { label: '逐步学会', patch: { events: 'A-in,H,B-in,H,A-in,D-in' } },
      { label: '全是广播', patch: { events: 'A-in,H,B-in,H' } },
    ],
    simulate(inp: any) {
      const evs = String(inp.events).split(/[,，\s]+/).filter(Boolean);
      const issues: any[] = [];
      const badEv = evs.filter((e) => e !== 'H' && !/^([A-D])-in$/.test(e));
      if (!evs.length) issues.push(bad('events', '至少一个事件'));
      if (badEv.length) issues.push(bad('events', '不认识的事件：' + badEv.join('、') + '（用 A-in 或 H）'));
      const specs: FrameSpec[] = [];
      if (!issues.some((i) => i.severity === 'error')) {
        const table = new Map<number, string>();
        let floods = 0, directs = 0, learns = 0;
        const tableViews = (hot: number) => [{ kind: 'fields' as const, label: '转发表', items: [1, 2, 3, 4].map((pt) => ({ text: table.get(pt) ?? '空', sub: '端口 ' + pt, state: pt === hot ? ('done' as const) : table.has(pt) ? ('active' as const) : ('idle' as const) })) }];
        specs.push({ type: 'INIT', narration: '交换机 4 个端口，转发表全空（A@P1 B@P2 C@P3 D@P4）', views: tableViews(-1) });
        evs.forEach((e, i) => {
          if (e === 'H') {
            floods++;
            specs.push({ type: 'FLOOD', narration: (i + 1) + '. 目的未知或广播：向除入口外的所有端口泛洪', views: [{ kind: 'chips' as const, label: '端口动作', items: [1, 2, 3, 4].map((pt) => ({ text: 'P' + pt, sub: '转发', state: 'warn' as const })) }], metrics: [{ label: '泛洪次数', value: floods }] });
          } else {
            const host = e[0]!;
            const port = HOSTS[host]!;
            const isNew = !table.has(port);
            table.set(port, host);
            if (isNew) learns++;
            const peer = host === 'A' ? 'B' : 'A';
            const known = [...table.values()].includes(peer);
            if (known) directs++; else floods++;
            const note = (isNew ? '学习 ' + host + '→P' + port : '已有表项，刷新计时器') + '；查目的 ' + peer + (known ? '：在表里，点对点转发' : '：不在表里，泛洪');
            specs.push({ type: 'LEARN', narration: (i + 1) + '. ' + host + ' 从端口 ' + port + ' 发帧：' + note, views: tableViews(port), metrics: [{ label: '学习次数', value: learns }, { label: '泛洪次数', value: floods }, { label: '直达次数', value: directs }] });
          }
        });
        specs.push({
          type: 'DONE',
          narration: '表里共 ' + table.size + ' 项；泛洪 ' + floods + ' 次、点对点 ' + directs + ' 次',
          views: tableViews(-1),
          metrics: [{ label: '表项数', value: table.size }, { label: '泛洪次数', value: floods }, { label: '点对点次数', value: directs }],
        });
      }
      return buildSimulation(meta, inp, specs, issues);
    },
  };
})();

export const batch15 = { datapathRegs, hrrn, workingSet, spooling, dirAccess, httpPersist, tcpUdpHeader, switchLearn } as const;
