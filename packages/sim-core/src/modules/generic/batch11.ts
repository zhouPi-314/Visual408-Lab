import type { GenericModuleDef } from '../../view';
import { bad, buildSimulation, type FrameSpec } from './kit';

const M = (id: string, subject: "ds" | "co" | "os" | "net", title: string, inp: any) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  input: inp,
});

/**
 * 第十一批：两级页表、读者写者、生产者消费者、SR 选择重传、
 * 以太网帧、RIP 距离向量、IPv6 地址、停等协议。
 */

const mk = (meta: any, input: any, summary: string, takeaway: string, fields: GenericModuleDef<any>['fields']) => ({ meta, summary, takeaway, fields, defaultInput: input } as const);

const pageTable2: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.multilevel-page-table", "os", "两级页表地址转换", { vaddr: "5:1:100" });
  const base = mk(meta, input, '一级页目录 → 二级页表 → 页框，每级都要一次访存。', '几级页表就要几次访存才能拿到物理页，TLB 就是为了省掉这些访存。', [{ key: 'vaddr', label: '虚拟地址（一级索引:二级索引:偏移）', type: 'text' as const, placeholder: '5:1:100' }]);
  const L1 = [10, 20, 30, -1, -1, 40, -1, -1];
  const L2: number[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [], [], [10, 11, 12], [], []];
  const pageSize = 4096;
  return {
    ...base,
    presets: [{ label: '两级都在', patch: { vaddr: '5:1:100' } }, { label: '一级未分配', patch: { vaddr: '7:0:0' } }, { label: '二级页缺失', patch: { vaddr: '0:2:8' } }],
    simulate(input: any) {
      const parts = String(input.vaddr).split(':').map(Number);
      const i1 = parts.length === 3 ? parts[0]! : -1;
      const i2 = parts.length === 3 ? parts[1]! : -1;
      const off = parts.length === 3 ? parts[2]! : -1;
      const issues: any[] = [];
      if (parts.length !== 3) issues.push(bad('vaddr', '格式必须是 一级索引:二级索引:页内偏移'));
      else if (i1 < 0 || i1 >= L1.length) issues.push(bad('vaddr', '一级索引要在 0 到 ' + (L1.length - 1) + ' 之间'));
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        specs.push({ type: 'INIT', narration: '虚拟地址 ' + i1 + ':' + i2 + ':' + off, views: [{ kind: 'fields', label: '地址分解', items: [{ text: String(i1), sub: '一级索引' }, { text: String(i2), sub: '二级索引' }, { text: String(off), sub: '页内偏移' }] }] });
        const e1 = L1[i1]!;
        specs.push({
          type: 'LEVEL1',
          narration: e1 < 0 ? '一级页目录第 ' + i1 + ' 项为空，缺页中断' : '查一级页目录第 ' + i1 + ' 项，得到二级页表首址 ' + e1,
          views: [{ kind: 'fields', label: '一级页目录', items: L1.map((v, idx) => ({ text: v < 0 ? '未分配' : '表 ' + v, sub: '项 ' + idx })) }],
          metrics: [{ label: '访存次数', value: 1 }],
        });
        if (e1 >= 0) {
          const frame = L2[i1]![i2] ?? -1;
          specs.push({
            type: 'LEVEL2',
            narration: frame < 0 ? '二级页表项为空，缺页中断' : '查二级页表第 ' + i2 + ' 项，得到页框 ' + frame,
            views: [{ kind: 'fields', label: '二级页表', items: L2[i1]!.map((v, idx) => ({ text: v < 0 ? '未分配' : '框 ' + v, sub: '项 ' + idx })) }],
            metrics: [{ label: '访存次数', value: 2 }],
          });
          if (frame >= 0) {
            const phys = frame * pageSize + off;
            specs.push({
              type: 'DONE',
              narration: '物理地址 = ' + frame + '×' + pageSize + ' + ' + off + ' = ' + phys + '，一共访存 3 次',
              views: [{ kind: 'fields', label: '结果', items: [{ text: String(frame), sub: '页框号' }, { text: String(phys), sub: '物理地址' }] }],
              metrics: [{ label: '物理地址', value: phys }, { label: '访存次数', value: 3 }],
            });
          }
        }
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const readersWriters: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.readers-writers", "os", "读者写者问题", { actions: "r,r,w,r,w", count: "2" });
  const base = mk(meta, input, '读读可以并行，读写和写写必须互斥。', '读者写者问题：读写互斥、写写互斥，读读可以共享，第一个读者和最后一个读者负责开关锁。', [{ key: 'actions', label: '操作序列（r 读 / w 写）', type: 'text' as const, placeholder: 'r,r,w' }, { key: 'count', label: '每次同时进来几个读者', type: 'number' as const, min: 1, max: 4 }]);
  return {
    ...base,
    presets: [{ label: '读写冲突', patch: { actions: 'r,r,w,r,w', count: '2' } }, { label: '纯读并行', patch: { actions: 'r,r,r,w', count: '3' } }],
    simulate(input: any) {
      const acts = String(input.actions).split(/[,,\s]+/).filter(Boolean);
      const cnt = Number(input.count) || 1;
      const issues = acts.length ? [] : [bad('actions', '至少一个操作 r 或 w')];
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        let reading = 0, writing = false, busy = 0, waits = 0;
        specs.push({ type: 'INIT', narration: '共享文件上开始处理 ' + acts.length + ' 个操作', views: [{ kind: 'chips', label: '共享文件', items: [{ text: '空闲', state: 'idle' as const }] }] });
        acts.forEach((a, i) => {
          let state = 'ok';
          if (a === 'r') { if (writing) { waits++; state = 'warn'; } else { reading++; busy++; } }
          else { if (reading > 0 || writing) { waits++; state = 'warn'; } else writing = true; }
          const desc = a === 'r' ? (state === 'warn' ? '等写者退出' : '读，当前读者 ' + reading + ' 个') : (state === 'warn' ? '等读者退出' : '写，独占');
          specs.push({
            type: 'OP',
            narration: '操作 ' + (i + 1) + '（' + a + '）：' + desc,
            views: [{ kind: 'chips', label: '操作序列', items: acts.map((x, j) => ({ text: x, sub: j === i ? desc : '', state: (j < i ? 'done' : j === i ? (state === 'warn' ? 'warn' : 'active') : 'idle') as 'done' | 'warn' | 'active' | 'idle' })) }],
            metrics: [{ label: '读者数', value: reading }, { label: '写者数', value: writing ? 1 : 0 }, { label: '等待次数', value: waits }],
          });
        });
        specs.push({
          type: 'DONE',
          narration: '完成，等待冲突 ' + waits + ' 次：读读并行，读写互斥',
          views: [{ kind: 'timeline', label: '操作时间线', span: acts.length, segments: acts.map((x, i) => ({ start: i, end: i + 1, label: x, state: 'done' as const })) }],
          metrics: [{ label: '等待冲突', value: waits }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const producerConsumer: GenericModuleDef<any> = (() => {
  const { meta, input } = M("os.producer-consumer", "os", "生产者消费者问题", { events: "P,P,P,C,P,C,C", size: "3" });
  const base = mk(meta, input, '三个信号量：空槽、满槽、互斥，缺一个都可能死锁或竞态。', '空槽与满槽数量之和等于缓冲区容量，互斥信号量保护进出缓冲区的操作。', [{ key: 'events', label: '事件序列（P 生产 / C 消费）', type: 'text' as const, placeholder: 'P,P,C' }, { key: 'size', label: '缓冲区容量', type: 'number' as const, min: 1, max: 6 }]);
  return {
    ...base,
    presets: [{ label: '正常交替', patch: { events: 'P,P,P,C,P,C,C', size: '3' } }, { label: '缓冲区满', patch: { events: 'P,P,P,P,C', size: '3' } }, { label: '空缓冲区消费', patch: { events: 'P,C,C', size: '2' } }],
    simulate(input: any) {
      const evs = String(input.events).split(/[,,\s]+/).filter(Boolean);
      const size = Number(input.size) || 3;
      const issues = evs.length ? [] : [bad('events', '至少一个事件 P 或 C')];
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        let buf = 0, block = 0;
        specs.push({ type: 'INIT', narration: '缓冲区容量 ' + size + '，当前空槽 ' + size + '，满槽 0', views: [{ kind: 'fields', label: '信号量初值', items: [{ text: String(size), sub: '空槽' }, { text: '0', sub: '满槽' }, { text: '1', sub: '互斥' }] }] });
        evs.forEach((e, i) => {
          let note = '';
          let bad_ = false;
          if (e === 'P') { if (buf >= size) { block++; bad_ = true; note = '缓冲区满，生产者阻塞' } else { buf++; note = '放入一个产品，占 ' + buf + '/' + size } }
          else { if (buf <= 0) { block++; bad_ = true; note = '缓冲区空，消费者阻塞' } else { buf--; note = '取走一个产品，剩 ' + buf + '/' + size } }
          specs.push({
            type: 'OP',
            narration: '事件 ' + (i + 1) + '（' + e + '）：' + note,
            views: [
              { kind: 'chips', label: '事件序列', items: evs.map((x, j) => ({ text: x, sub: j === i ? note : '', state: (j < i ? 'done' : j === i ? (bad_ ? 'warn' : 'active') : 'idle') as 'done' | 'warn' | 'active' | 'idle' })) },
              { kind: 'bars', label: '缓冲区占用', max: size, items: [...Array(size).keys()].map((k) => ({ label: '槽' + k, value: k < buf ? 1 : 0, state: (k < buf ? 'done' : 'idle') as 'done' | 'idle' })) },
            ],
            metrics: [{ label: '占用', value: buf }, { label: '空槽', value: size - buf }, { label: '满槽', value: buf }, { label: '阻塞次数', value: block }],
          });
        });
        specs.push({
          type: 'DONE',
          narration: '结束，占用 ' + buf + '/' + size + '，阻塞 ' + block + ' 次',
          views: [{ kind: 'timeline', label: '事件时间线', span: evs.length, segments: evs.map((x, i) => ({ start: i, end: i + 1, label: x, state: 'done' as const })) }],
          metrics: [{ label: '最终占用', value: buf }, { label: '阻塞次数', value: block }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const stopWait: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.stop-wait", "net", "停等协议与 ARQ", { frames: "4", lostAt: "2" });
  const base = mk(meta, input, '发一帧等一个确认，丢了就超时重传。', '停等协议：一次只发一帧，收不到确认就超时重传，信道利用率最低但最简单。', [{ key: 'frames', label: '要发几帧', type: 'number' as const, min: 1, max: 8 }, { key: 'lostAt', label: '第几帧丢失（0 表示不丢）', type: 'number' as const, min: 0, max: 8 }]);
  return {
    ...base,
    presets: [{ label: '不丢帧', patch: { frames: '3', lostAt: '0' } }, { label: '数据帧丢失', patch: { frames: '4', lostAt: '2' } }, { label: '确认丢失', patch: { frames: '3', lostAt: '3' } }],
    simulate(input: any) {
      const n = Number(input.frames), lost = Number(input.lostAt) || 0;
      const issues = n >= 1 && n <= 8 ? [] : [bad('frames', '帧数要写 1 到 8')];
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        let sent = 0, acked = 0, retrans = 0;
        specs.push({ type: 'INIT', narration: '开始停等传输，共 ' + n + ' 帧数据', views: [{ kind: 'chips', label: '发送方', items: [{ text: '准备发送', state: 'idle' as const }] }] });
        for (let i = 1; i <= n; i++) {
          sent++;
          if (lost === i) {
            retrans++;
            specs.push({
              type: 'TIMEOUT',
              narration: "第 " + i + " 帧超时没等到确认，重传一帧",
              views: [{ kind: 'timeline', label: '传输过程', span: n + retrans, segments: [{ start: sent - 1, end: sent, label: '帧' + i, state: 'bad' as const }] }],
              metrics: [{ label: '已发送', value: sent }, { label: '重传', value: retrans }],
            });
          }
          specs.push({
            type: 'SEND',
            narration: '发送第 ' + i + ' 帧，等待确认',
            views: [{ kind: 'timeline', label: '传输过程', span: n + retrans, segments: [...Array(n + retrans).keys()].map((k) => ({ start: k, end: k + 1, label: '', state: (k < sent - 1 ? 'done' : k === sent - 1 ? 'active' : 'idle') as 'done' | 'active' | 'idle' })) }],
            metrics: [{ label: '已发送', value: sent }],
          });
          specs.push({
            type: 'ACK',
            narration: '收到第 ' + i + ' 帧的确认，发送下一帧',
            views: [{ kind: 'chips', label: '确认', items: [...Array(n).keys()].map((k) => ({ text: '确认 ' + (k + 1), state: (k < i ? 'done' : 'idle') as 'done' | 'idle' })) }],
            metrics: [{ label: '已确认', value: i }],
          });
          acked = i;
        }
        specs.push({
          type: 'DONE',
          narration: '全部确认，共发送 ' + sent + ' 帧、重传 ' + retrans + ' 帧',
          views: [{ kind: 'fields', label: '统计', items: [{ text: String(sent), sub: '发送' }, { text: String(retrans), sub: '重传' }] }],
          metrics: [{ label: '发送帧数', value: sent }, { label: '重传帧数', value: retrans }],
        });
        void acked;
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const selectiveRepeat: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.selective-repeat", "net", "选择重传 SR", { frames: "6", window: "3", lost: "2" });
  const base = mk(meta, input, '窗口里的帧都发出去，哪帧丢就只补哪帧。', '选择重传只重传丢失的帧，GBN 要把丢失帧之后的全部帧重发一遍，代价差别很大。', [{ key: 'frames', label: '总帧数', type: 'number' as const, min: 3, max: 10 }, { key: 'window', label: '发送窗口', type: 'number' as const, min: 1, max: 6 }, { key: 'lost', label: '丢失的帧号（0 表示不丢）', type: 'number' as const, min: 0, max: 10 }]);
  return {
    ...base,
    presets: [{ label: '丢一帧', patch: { frames: '6', window: '3', lost: '2' } }, { label: '不丢帧', patch: { frames: '6', window: '3', lost: '0' } }],
    simulate(input: any) {
      const n = Number(input.frames), w = Number(input.window), lost = Number(input.lost) || 0;
      const issues: any[] = [];
      if (n < 3 || n > 10) issues.push(bad('frames', '帧数取 3 到 10'));
      if (lost > n) issues.push(bad('lost', '丢失帧号不能超过总帧数'));
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        specs.push({ type: 'INIT', narration: '总 ' + n + ' 帧，窗口 ' + w + '，第 ' + lost + ' 帧丢失', views: [{ kind: 'chips', label: '参数', items: [{ text: '窗口 ' + w, state: 'done' as const }, { text: '丢帧 ' + lost, state: lost ? 'warn' as const : 'idle' as const }] }] });
        const okFrames: number[] = [];
        const retrans: number[] = [];
        const win: number[] = [];
        for (let i = 1; i <= n; i++) {
          if (lost && i === lost) { retrans.push(i); specs.push({ type: 'LOST', narration: '第 ' + i + ' 帧在途中丢失，接收方缓存后续帧', views: [{ kind: 'chips', label: '接收缓存', items: [...win, i].map((k) => ({ text: '帧' + k, sub: k === i ? '丢失' : '已收到', state: (k === i ? 'bad' : 'done') as 'bad' | 'done' })) }], metrics: [{ label: '丢失', value: 1 }] }); }
          else { okFrames.push(i); win.push(i); }
        }
        specs.push({
          type: 'RETRANS',
          narration: retrans.length ? '单独重传第 ' + retrans.join(',') + ' 帧，接收方按序号重排后一次交付' : '没有丢帧，一次窗口发送就全部确认',
          views: [{ kind: 'chips', label: '重传的帧', items: (retrans.length ? retrans : [0]).filter((k) => k > 0).map((k) => ({ text: '帧' + k, state: 'active' as const })) }],
          metrics: [{ label: '重传帧数', value: retrans.length }],
        });
        const gbn = retrans.length ? n - (lost - 1) : 0;
        specs.push({
          type: 'DONE',
          narration: 'SR 只重传 ' + retrans.length + ' 帧；GBN 会把第 ' + lost + ' 帧之后的 ' + (gbn ? n - lost + 1 : 0) + ' 帧全部重发',
          views: [{ kind: 'matrix', label: '对比', columns: ['协议', '重传帧数'], rowHeaders: ['SR', 'GBN'], rows: [['SR', retrans.length], ['GBN', gbn]] }],
          metrics: [{ label: 'SR重传', value: retrans.length }, { label: 'GBN重传', value: gbn }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const ethernetFrame: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.ethernet-frame", "net", "以太网帧格式", { payload: "20", dest: "01:00:5E:00:00:01" });
  const base = mk(meta, input, '目的 MAC 6 字节 + 源 MAC 6 字节 + 类型 2 字节 + 数据（至少 46）+ 校验 4 字节。', '帧长最短 64 字节：数据不够 46 字节要填充，否则接收方分不清填充和真数据。', [{ key: 'payload', label: '数据长度（字节）', type: 'number' as const, min: 1, max: 1500 }, { key: 'dest', label: '目的 MAC（冒号分隔）', type: 'text' as const, placeholder: '01:00:5E:00:00:01' }]);
  return {
    ...base,
    presets: [{ label: '短帧要填充', patch: { payload: '20', dest: '01:00:5E:00:00:01' } }, { label: '正好 46', patch: { payload: '46', dest: '00:11:22:33:44:55' } }, { label: '长帧', patch: { payload: '1500', dest: '00:11:22:33:44:55' } }],
    simulate(input: any) {
      const len = Number(input.payload);
      const mac = String(input.dest).trim();
      const issues: any[] = [];
      if (!(len >= 1 && len <= 1500)) issues.push(bad('payload', '数据长度要写 1 到 1500 字节'));
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        const segs = [['前导码', 8], ['目的 MAC', 6], ['源 MAC', 6], ['类型', 2], ['数据', len], ['校验 FCS', 4]] as [string, number][];
        const pad = len < 46 ? 46 - len : 0;
        const bytesNoPreamble = 6 + 6 + 2 + len + pad + 4;
        const total = bytesNoPreamble + 8;
        specs.push({ type: 'INIT', narration: '数据 ' + len + ' 字节，目的 MAC ' + mac, views: [{ kind: 'fields', label: '输入', items: [{ text: len + ' 字节', sub: '数据长度' }, { text: mac, sub: '目的 MAC' }] }] });
        specs.push({
          type: 'LAYOUT',
          narration: '帧结构：MAC 首部 14 字节 + 数据 + FCS 4 字节',
          views: [{ kind: 'bars', label: '各段字节数', max: Math.max(46, len + pad), items: segs.map(([label, n]) => ({ label, value: n, state: (n === 0 ? 'idle' : 'done') as 'idle' | 'done' })) }],
          metrics: [{ label: '数据段', value: len }],
        });
        if (pad > 0) {
          specs.push({
            type: 'PAD',
            narration: '数据不足 46 字节，填充 ' + pad + ' 字节才够最小帧长',
            views: [{ kind: 'fields', label: '填充', items: [{ text: String(pad), sub: '填充字节' }, { text: '64 字节', sub: '最小帧长' }] }],
            metrics: [{ label: '填充', value: pad }],
          });
        }
        specs.push({
          type: 'DONE',
          narration: '整帧 ' + total + ' 字节（含 8 字节前导码），帧体 ' + bytesNoPreamble + ' 字节，' + (pad ? '已填充' : '无需填充'),
          views: [{ kind: 'fields', label: '结果', items: [{ text: total + ' 字节', sub: '整帧' }, { text: bytesNoPreamble + ' 字节', sub: '帧体' }, { text: pad + ' 字节', sub: '填充' }] }],
          metrics: [{ label: '整帧字节', value: total }, { label: '帧体字节', value: bytesNoPreamble }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const rip: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.rip", "net", "RIP 距离向量路由", { edges: "A,B,1;B,C,1;A,C,5", source: "A" });
  const base = mk(meta, input, '每轮和邻居交换距离向量，逐步收敛到最短跳数。', 'RIP 用跳数做代价，最大 15 跳；距离向量要靠多轮交换才收敛。', [{ key: 'edges', label: '链路（起点,终点,代价；分号分隔）', type: 'text' as const, placeholder: 'A,B,1' }, { key: 'source', label: '源节点', type: 'text' as const, placeholder: 'A' }]);
  return {
    ...base,
    presets: [{ label: '三角形', patch: { edges: 'A,B,1;B,C,1;A,C,5', source: 'A' } }, { label: '四节点', patch: { edges: 'A,B,1;B,C,2;A,C,4;C,D,1', source: 'A' } }],
    simulate(input: any) {
      const edges: [string, string, number][] = String(input.edges)
        .split(/;|，/)
        .map((t) => t.split(/[,,\s]+/).filter(Boolean).map((x) => x) as string[])
        .filter((a) => a.length === 3)
        .map((a) => [a[0]!, a[1]!, Number(a[2]!)] as [string, string, number]);
      const source = String(input.source).trim();
      const nodes = [...new Set([...edges.flatMap((e) => [e[0], e[1]]), source])].filter((x) => x).sort();
      const issues: any[] = [];
      if (edges.length < 1) issues.push(bad('edges', '至少一条链路（起点,终点,代价）'));
      if (!nodes.includes(source)) issues.push(bad('source', '源节点要在拓扑里'));
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        const INF = 16;
        const dist = new Map<string, number>(nodes.map((n) => [n, n === source ? 0 : INF]));
        const adj = new Map<string, [string, number][]>(nodes.map((n) => [n, []]));
        for (const [u, v, w] of edges) { adj.get(u)!.push([v, w]); adj.get(v)!.push([u, w]); }
        specs.push({ type: 'INIT', narration: '源节点 ' + source + '，' + nodes.length + ' 个路由器', views: [{ kind: 'fields', label: '链路', items: edges.map(([u, v, w]) => ({ text: String(w), sub: u + '-' + v })) }] });
        const rounds: string[][] = [];
        for (let r = 0; r < nodes.length; r++) {
          rounds.push(nodes.map((n) => String(dist.get(n))));
          let changed = false;
          for (const n of nodes) {
            for (const [nb, w] of adj.get(n)!) {
              const nd = dist.get(n)! + w;
              if (nd < dist.get(nb)!) { dist.set(nb, nd); changed = true; }
            }
          }
          specs.push({
            type: 'ROUND',
            narration: '第 ' + (r + 1) + ' 轮交换后：' + nodes.map((n) => n + '=' + dist.get(n)).join('，'),
            views: [{ kind: 'fields', label: '第 ' + (r + 1) + ' 轮距离', items: nodes.map((n) => ({ text: String(dist.get(n)), sub: n })) }],
            metrics: [{ label: '轮次', value: r + 1 }],
          });
          if (!changed) { specs.push({ type: 'CONVERGED', narration: '距离向量不再变化，路由收敛', views: [{ kind: 'chips', label: '状态', items: [{ text: '收敛', state: 'done' as const }] }] }); break; }
        }
        specs.push({
          type: 'DONE',
          narration: '最终距离向量：' + nodes.map((n) => n + '=' + dist.get(n)).join('，'),
          views: [{ kind: 'matrix', label: '距离向量收敛表', columns: rounds.map((_, i) => '第 ' + (i + 1) + ' 轮'), rowHeaders: nodes, rows: rounds },
            { kind: 'chips', label: '源节点路由表', items: nodes.filter((n) => n !== source).map((n) => ({ text: '到 ' + n, sub: '跳数 ' + dist.get(n), state: 'done' as const })) }],
          metrics: [{ label: '源', value: source }, { label: '最大跳数', value: Math.max(...nodes.map((n) => dist.get(n)!)) }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();
const ipv6: GenericModuleDef<any> = (() => {
  const { meta, input } = M("net.ipv6-address", "net", "IPv6 地址压缩", { addr: "2001:0db8:0000:0000:0000:ff00:0042:8329", prefix: "64" });
  const base = mk(meta, input, '每组去前导零，最长一段全零用 :: 代替。', 'IPv6 地址 128 位，每组前导零可省，最长一段连续全零用 :: 压缩，只能用一次。', [{ key: 'addr', label: 'IPv6 地址（冒号分隔 8 组）', type: 'text' as const, placeholder: '2001:0db8::' }, { key: 'prefix', label: '前缀长度', type: 'number' as const, min: 1, max: 128 }]);
  return {
    ...base,
    presets: [{ label: '教材例题', patch: { addr: '2001:0db8:0000:0000:0000:ff00:0042:8329', prefix: '64' } }, { label: '全零段最多', patch: { addr: 'fe80:0000:0000:0000:0202:b3ff:fe1e:8329', prefix: '64' } }],
    simulate(input: any) {
      const addr = String(input.addr).trim();
      const prefix = Number(input.prefix) || 64;
      const groups = addr.split(':');
      const issues: any[] = [];
      if (groups.length !== 8) issues.push(bad('addr', '完整 IPv6 地址要有 8 组，用冒号分隔'));
      const specs: FrameSpec[] = [];
      if (!issues.some((x) => x.severity === 'error')) {
        const stripped = groups.map((g) => g.replace(/^0+/, '') || '0');
        specs.push({ type: 'INIT', narration: '原始地址有 8 组，每组 16 位', views: [{ kind: 'fields', label: '原始分组', items: groups.map((g, i) => ({ text: g, sub: '组 ' + (i + 1) })) }] });
        specs.push({
          type: 'STRIP',
          narration: '去掉每组的前导零',
          views: [{ kind: 'fields', label: '去前导零', items: stripped.map((g, i) => ({ text: g, sub: '组 ' + (i + 1) })) }],
        });
        let best = -1, bestLen = 0, cur = -1, curLen = 0;
        stripped.forEach((g, i) => { if (g === '0') { if (cur < 0) { cur = i; curLen = 1; } else curLen++; if (curLen > bestLen) { best = cur; bestLen = curLen; } } else { cur = -1; curLen = 0; } });
        let compressed = stripped.join(':');
        if (best >= 0 && bestLen >= 2) {
          const before = stripped.slice(0, best).join(':');
          const after = stripped.slice(best + bestLen).join(':');
          compressed = before + '::' + after;
          specs.push({
            type: 'COMPRESS',
            narration: '第 ' + (best + 1) + ' 到 ' + (best + bestLen) + ' 组是全零，用 :: 代替这一段',
            views: [{ kind: 'fields', label: '零压缩', items: [{ text: '组 ' + (best + 1) + '–' + (best + bestLen), sub: '压缩段' }, { text: String(bestLen), sub: '组数' }] }],
            metrics: [{ label: '压缩组数', value: bestLen }],
          });
        } else {
          specs.push({ type: 'COMPRESS', narration: '没有连续两段以上的全零，不需要 ::', views: [{ kind: 'chips', label: '说明', items: [{ text: '无需零压缩', state: 'idle' as const }] }] });
        }
        const netBits = prefix;
        specs.push({
          type: 'DONE',
          narration: '压缩写法：' + compressed + '/' + prefix + '，前 ' + netBits + ' 位是网络前缀',
          views: [{ kind: 'fields', label: '结果', items: [{ text: compressed + '/' + prefix, sub: '压缩写法' }, { text: '128 位', sub: '地址长度' }] }],
          metrics: [{ label: '压缩写法', value: compressed + '/' + prefix }, { label: '前缀长度', value: prefix }],
        });
      }
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

export const batch11 = { pageTable2, readersWriters, producerConsumer, stopWait, selectiveRepeat, ethernetFrame, rip, ipv6 } as const;