import type { FieldDef } from "../../view";
import type { GenericModuleDef } from "../../view";
import { bad, buildSimulation, type FrameSpec } from "./kit";

const M = (id: string, subject: "os" | "net", title: string, summary: string, takeaway: string, fields: FieldDef[]) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  summary,
  takeaway,
  fields,
});

/* ---------------- 9. 银行家算法 ---------------- */
const banker: GenericModuleDef<any> = (() => {
  const MAX = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
  const ALLOC = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
  const base = M("os.banker", "os", "银行家算法与安全序列",
    "五个进程、三种资源，按「Need ≤ Available」逐步试探，找出安全序列。",
    "找不到安全序列就说明系统处于不安全状态",
    [{ key: "available", label: "初始可用资源（A,B,C）", type: "text" as const }]);
  interface Input { available: string }
  return {
    ...base,
    defaultInput: { available: "3,3,2" } as Input,
    simulate(input: Input) {
      const issues = [];
      const avail = input.available.split(/[,\s]+/).filter(Boolean).map(Number);
      if (avail.length !== 3 || avail.some((x) => !Number.isInteger(x) || x < 0)) issues.push(bad("available", "请输入 3 个非负整数"));
      const work = [...avail];
      const finish = [false, false, false, false, false];
      const seq: number[] = [];
      const specs: FrameSpec[] = [];
      const matrix = (hotRow?: number) => ({
        kind: "matrix" as const,
        label: "Need 矩阵（Max − Allocation）",
        columns: ["A", "B", "C"],
        rowHeaders: ["P0", "P1", "P2", "P3", "P4"],
        rows: MAX.map((m, i) => m.map((v, j) => v - ALLOC[i]![j]!)),
        ...(hotRow !== undefined ? { highlight: [[hotRow, 0], [hotRow, 1], [hotRow, 2]] as [number, number][] } : {}),
      });
      const availView = () => ({ kind: "fields" as const, label: "Available", items: work.map((v, i) => ({ text: String(v), sub: ["A", "B", "C"][i]!, state: "active" as const })) });
      specs.push({ type: "INIT", narration: `初始可用 (${work.join(",")})，开始寻找安全序列`, views: [matrix(), availView()], metrics: [{ label: "已选进程", value: 0 }] });
      let progressed = true;
      while (progressed && seq.length < 5) {
        progressed = false;
        for (let i = 0; i < 5; i++) {
          if (finish[i]) continue;
          const need = MAX[i]!.map((m, j) => m - ALLOC[i]![j]!);
          const okRow = need.every((n, j) => n <= work[j]!);
          specs.push({
            type: okRow ? "SATISFY" : "CHECK",
            narration: okRow
              ? `P${i} 的 Need (${need.join(",")}) ≤ Available (${work.join(",")}) → 可以满足`
              : `P${i} 的 Need (${need.join(",")}) > Available (${work.join(",")}) → 暂不能满足`,
            views: [matrix(i), availView()],
          });
          if (!okRow) continue;
          finish[i] = true;
          seq.push(i);
          for (let j = 0; j < 3; j++) work[j] = work[j]! + ALLOC[i]![j]!;
          progressed = true;
          specs.push({ type: "FINISH", narration: `P${i} 执行完成并归还资源 → Available (${work.join(",")})`, views: [matrix(), availView()], metrics: [{ label: "已选进程", value: seq.length }] });
        }
      }
      const safe = seq.length === 5;
      specs.push({
        type: "DONE",
        narration: safe ? `安全序列：${seq.map((i) => "P" + i).join(" → ")}` : `未能找到安全序列，系统不安全（已确定 ${seq.length} 个进程）`,
        views: [{ kind: "chips", label: "安全序列", items: seq.map((i) => ({ text: "P" + i, state: sameState(i) })) }, availView()],
        metrics: [{ label: "安全", value: safe ? "是" : "否", tone: safe ? "good" : "bad" }],
      });
      function sameState(i: number) { return seq.includes(i) ? ("done" as const) : ("idle" as const); }
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 10. 信号量 PV ---------------- */
const semaphore: GenericModuleDef<any> = (() => {
  const base = M("os.semaphore", "os", "PV 操作与生产者-消费者",
    "P 操作先减后判、V 操作先加后放行，信号量的变化直接决定进程是否阻塞。",
    "P 可能阻塞，V 一定不阻塞",
    [
      { key: "bufferSize", label: "缓冲区大小", type: "select" as const, options: [1, 3, 5].map((v) => ({ value: String(v), label: String(v) })) },
      { key: "ops", label: "操作序列", type: "text" as const },
    ]);
  interface Input { bufferSize: string; ops: string }
  return {
    ...base,
    defaultInput: { bufferSize: "3", ops: "P(empty), P(mutex), 放入1, V(mutex), V(full), P(full), P(mutex), 取出1, V(mutex), V(empty)" } as Input,
    simulate(input: Input) {
      const issues = [];
      const n = Number(input.bufferSize);
      const ops = input.ops.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      if (ops.length === 0 || ops.length > 12) issues.push(bad("ops", "操作数需为 1–12 条"));
      let empty = n, full = 0, mutex = 1;
      const buffer: number[] = [];
      const specs: FrameSpec[] = [];
      const view = (label: string) => [
        { kind: "fields" as const, label: "信号量", items: [
          { text: String(empty), sub: "empty", state: empty === 0 ? "bad" as const : "idle" as const },
          { text: String(full), sub: "full", state: full === n ? "bad" as const : "idle" as const },
          { text: String(mutex), sub: "mutex", state: mutex === 0 ? "warn" as const : "idle" as const },
        ] },
        { kind: "chips" as const, label: `缓冲区（容量 ${n}）`, items: buffer.map((x) => ({ text: String(x), state: "done" as const })) },
      ];
      specs.push({ type: "INIT", narration: `初始 empty=${n}、full=0、mutex=1`, views: view("") });
      let blocked = 0;
      for (const op of ops) {
        if (/^P\(empty\)$/i.test(op)) { empty -= 1; if (empty < 0) { blocked++; specs.push({ type: "BLOCK", narration: "empty < 0 → 缓冲区满，生产者阻塞", views: view(""), metrics: [{ label: "阻塞", value: blocked }] }); empty = 0; } else specs.push({ type: "P", narration: `P(empty)：empty=${empty}`, views: view("") }); }
        else if (/^V\(full\)$/i.test(op)) { full += 1; specs.push({ type: "V", narration: `V(full)：full=${full}`, views: view("") }); }
        else if (/^P\(full\)$/i.test(op)) { full -= 1; if (full < 0) { blocked++; specs.push({ type: "BLOCK", narration: "full < 0 → 缓冲区空，消费者阻塞", views: view(""), metrics: [{ label: "阻塞", value: blocked }] }); full = 0; } else specs.push({ type: "P", narration: `P(full)：full=${full}`, views: view("") }); }
        else if (/^V\(empty\)$/i.test(op)) { empty += 1; specs.push({ type: "V", narration: `V(empty)：empty=${empty}`, views: view("") }); }
        else if (/^P\(mutex\)$/i.test(op)) { mutex -= 1; specs.push({ type: "P", narration: `P(mutex)：mutex=${mutex}（互斥区加锁）`, views: view("") }); }
        else if (/^V\(mutex\)$/i.test(op)) { mutex += 1; specs.push({ type: "V", narration: `V(mutex)：mutex=${mutex}（解锁）`, views: view("") }); }
        else if (op.startsWith("放")) { const v = Number(op.replace(/\D/g, "")) || 1; buffer.push(v); specs.push({ type: "PUT", narration: `放入产品 ${v}`, views: view(""), metrics: [{ label: "缓冲", value: buffer.length }] }); }
        else if (op.startsWith("取")) { const v = buffer.shift(); specs.push({ type: "GET", narration: `取出产品 ${v ?? "（空）"}`, views: view(""), metrics: [{ label: "缓冲", value: buffer.length }] }); }
        else issues.push(bad("ops", `无法识别：${op}`));
      }
      specs.push({ type: "DONE", narration: `结束：缓冲 ${buffer.length} 个，empty=${empty}、full=${full}、mutex=${mutex}`, views: view(""), metrics: [{ label: "缓冲", value: buffer.length }, { label: "阻塞次数", value: blocked, tone: blocked > 0 ? "bad" : undefined }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 11. 磁盘调度 ---------------- */
const diskScheduling: GenericModuleDef<any> = (() => {
  const base = M("os.disk-scheduling", "os", "磁盘调度：FCFS / SSTF / SCAN",
    "同样的磁道请求，不同调度策略的磁头移动距离差异很大。",
    "SSTF 最短但可能饿死远端请求",
    [
      { key: "alg", label: "算法", type: "select" as const, options: [{ value: "fcfs", label: "FCFS" }, { value: "sstf", label: "SSTF" }, { value: "scan", label: "SCAN（向大）" }] },
      { key: "head", label: "磁头初始位置", type: "text" as const },
    ]);
  interface Input { alg: string; head: string }
  return {
    ...base,
    defaultInput: { alg: "sstf", head: "53" } as Input,
    simulate(input: Input) {
      const issues = [];
      const head0 = Number(input.head);
      if (!Number.isInteger(head0) || head0 < 0 || head0 > 199) issues.push(bad("head", "磁头位置需为 0–199"));
      const reqs = [98, 183, 37, 122, 14, 124, 65, 67];
      let cur = head0;
      const order: number[] = [];
      const remaining = [...reqs];
      let total = 0;
      const apply = (t: number) => { total += Math.abs(t - cur); order.push(t); cur = t; };
      if (input.alg === "fcfs") remaining.forEach(apply);
      else if (input.alg === "sstf") {
        while (remaining.length) {
          remaining.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
          const next = remaining.shift()!;
          apply(next);
        }
      } else {
        const sorted = [...reqs].sort((a, b) => a - b);
        sorted.filter((t) => t >= cur).forEach(apply);
        sorted.filter((t) => t < cur).sort((a, b) => b - a).forEach(apply);
      }
      const specs: FrameSpec[] = [{
        type: "START",
        narration: `磁头 ${head0}，请求序列 ${reqs.join(", ")}`,
        views: [{ kind: "chips", label: "待访问磁道", items: reqs.map((t) => ({ text: String(t) })) }],
      }];
      let acc = head0;
      order.forEach((t, i) => {
        const move = Math.abs(t - acc);
        specs.push({
          type: "MOVE",
          narration: `第 ${i + 1} 步：${acc} → ${t}，移动 ${move} 道`,
          views: [
            { kind: "timeline", label: "磁头轨迹", span: 200, segments: [{ start: Math.min(acc, t), end: Math.max(acc, t), label: String(move), state: "active" }], markers: [{ at: t, label: String(t) }] },
            { kind: "chips", label: "已访问", items: order.slice(0, i + 1).map((x) => ({ text: String(x), state: "done" })) },
          ],
          metrics: [{ label: "累计寻道", value: total > 0 ? order.slice(0, i + 1).reduce((s, x, k) => s + Math.abs(x - (k === 0 ? head0 : order[k - 1]!)), 0) : 0 }],
        });
        acc = t;
      });
      specs.push({ type: "DONE", narration: `总寻道长度 ${total} 道`, views: [{ kind: "chips", label: "访问顺序", items: order.map((x) => ({ text: String(x), state: "done" })) }], metrics: [{ label: "总寻道", value: total }] });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 12. inode 索引分配 ---------------- */
const inode: GenericModuleDef<any> = (() => {
  const base = M("os.inode", "os", "文件索引分配与 inode 寻址",
    "直接块、一级间接、二级间接各能覆盖多大文件，逐层算清楚。",
    "间接索引让文件大小指数级增长",
    [
      { key: "blockSize", label: "块大小", type: "select" as const, options: [1024, 4096].map((v) => ({ value: String(v), label: v / 1024 + " KB" })) },
      { key: "fileSize", label: "文件大小 KB", type: "select" as const, options: [4, 64, 1024, 70000].map((v) => ({ value: String(v), label: v + " KB" })) },
    ]);
  interface Input { blockSize: string; fileSize: string }
  return {
    ...base,
    defaultInput: { blockSize: "4096", fileSize: "1024" } as Input,
    simulate(input: Input) {
      const bs = Number(input.blockSize);
      const size = Number(input.fileSize) * 1024;
      const ptr = bs / 4;
      const direct = 10 * bs;
      const single = ptr * bs;
      const double = ptr * ptr * bs;
      const triple = ptr * ptr * ptr * bs;
      const blocks = Math.ceil(size / bs);
      const specs: FrameSpec[] = [
        { type: "DIRECT", narration: `10 个直接块可覆盖 ${direct / 1024} KB`, views: [{ kind: "fields", items: [{ text: "10", sub: "直接块" }, { text: (direct / 1024) + "KB", sub: "容量" }] }], metrics: [{ label: "需要块数", value: blocks }] },
        { type: "SINGLE", narration: `一级间接：${ptr} 个指针 → ${single / 1024} KB`, views: [{ kind: "bars", label: "各层容量（KB）", max: triple / 1024, items: [{ label: "直接", value: direct / 1024 }, { label: "一级", value: single / 1024, state: "active" }] }] },
        { type: "DOUBLE", narration: `二级间接：${ptr}×${ptr} → ${double / 1024} KB`, views: [{ kind: "bars", label: "各层容量（KB）", max: triple / 1024, items: [{ label: "直接", value: direct / 1024 }, { label: "一级", value: single / 1024 }, { label: "二级", value: double / 1024, state: "active" }] }] },
        {
          type: "RESOLVE", narration: `${input.fileSize} KB 文件需要 ${blocks} 个块 → ${size <= direct ? "只用直接块" : size <= direct + single ? "直接块 + 一级间接" : size <= direct + single + double ? "直接 + 一级 + 二级" : "需要三级间接"}`,
          views: [{ kind: "bars", label: "各层容量（KB）", max: triple / 1024, items: [{ label: "直接", value: direct / 1024, state: "done" }, { label: "一级", value: single / 1024, state: "done" }, { label: "二级", value: double / 1024, state: "done" }] }],
          metrics: [{ label: "块数", value: blocks }, { label: "块大小", value: bs / 1024 + "KB" }],
        },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 13. CRC 校验 ---------------- */
const crc: GenericModuleDef<any> = (() => {
  const base = M("net.crc", "net", "CRC 循环冗余校验",
    "数据后补零，用生成多项式做模 2 除法，余数就是校验码。",
    "模 2 除法没有借位，等价于异或",
    [
      { key: "data", label: "数据位串", type: "text" as const },
      { key: "poly", label: "生成多项式（位串）", type: "text" as const },
    ]);
  interface Input { data: string; poly: string }
  return {
    ...base,
    defaultInput: { data: "1101011011", poly: "10011" } as Input,
    simulate(input: Input) {
      const issues = [];
      const data = input.data.replace(/\s/g, "");
      const poly = input.poly.replace(/\s/g, "");
      if (!/^[01]{2,32}$/.test(data)) issues.push(bad("data", "数据必须是 2–32 位 0/1"));
      if (!/^[01]{2,16}$/.test(poly) || !poly.startsWith("1")) issues.push(bad("poly", "多项式必须以 1 开头"));
      const r = poly.length - 1;
      const buf = (data + "0".repeat(r)).split("").map(Number);
      const p = poly.split("").map(Number);
      const specs: FrameSpec[] = [{
        type: "PAD", narration: `数据 ${data} 后补 ${r} 个 0，被除数 ${buf.join("")}`,
        views: [{ kind: "bits", label: "被除数", groups: [{ label: "data + r 个 0", bits: buf }] }],
      }];
      for (let i = 0; i + p.length <= buf.length; i++) {
        if (buf[i] !== 1) continue;
        for (let j = 0; j < p.length; j++) buf[i + j] = buf[i + j]! ^ p[j]!;
        specs.push({
          type: "XOR", narration: `第 ${i + 1} 位为 1 → 与多项式异或，当前余数 ${buf.join("")}`,
          views: [{ kind: "bits", label: "逐步异或", groups: [{ label: `第 ${i + 1} 位`, bits: buf }] }],
        });
      }
      const rem = buf.slice(buf.length - r).join("");
      specs.push({
        type: "DONE", narration: `余数 = ${rem}（CRC 校验码），发送 ${data}${rem}`,
        views: [{ kind: "bits", label: "余数", groups: [{ label: "CRC", bits: buf.slice(buf.length - r) }] }, { kind: "fields", items: [{ text: rem, sub: "CRC 码" }, { text: data + rem, sub: "发送帧" }] }],
        metrics: [{ label: "CRC", value: rem }, { label: "多项式", value: poly }],
      });
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 14. 滑动窗口（GBN） ---------------- */
const gbn: GenericModuleDef<any> = (() => {
  const base = M("net.gbn-window", "net", "滑动窗口与回退 N（GBN）",
    "窗口内的帧连续发送，某个帧超时就整窗重传。",
    "接收窗口为 1，出错要回退重传",
    [{ key: "window", label: "发送窗口大小", type: "select" as const, options: [2, 3, 4].map((v) => ({ value: String(v), label: String(v) })) }]);
  interface Input { window: string }
  return {
    ...base,
    defaultInput: { window: "3" } as Input,
    simulate(input: Input) {
      const w = Number(input.window);
      const frames = [0, 1, 2, 3, 4];
      const specs: FrameSpec[] = [];
      const seq = (upTo: number, base0: number) => frames.slice(base0, upTo).map((f) => ({ text: String(f), state: "active" as const }));
      specs.push({ type: "SEND_WINDOW", narration: `窗口 ${w}：连续发送 0..${w - 1}`, views: [{ kind: "timeline", label: "发送/确认", span: 10, segments: frames.slice(0, w).map((f, i) => ({ start: i, end: i + 1, label: "帧" + f, state: "active" })) }] });
      specs.push({ type: "ACK", narration: `收到 ACK 0、ACK 1，窗口前移`, views: [{ kind: "timeline", label: "发送/确认", span: 10, segments: [{ start: 0, end: 2, label: "已确认", state: "done" }, ...frames.slice(2, 2 + w).map((f, i) => ({ start: 2 + i, end: 3 + i, label: "帧" + f, state: "active" as const }))] }] });
      specs.push({ type: "TIMEOUT", narration: `帧 2 超时 → 回退 N：重传窗口内所有帧 2..${2 + w - 1}`, views: [{ kind: "timeline", label: "发送/确认", span: 10, segments: [{ start: 0, end: 2, label: "已确认", state: "done" }, ...frames.slice(2, 2 + w).map((f, i) => ({ start: 4 + i, end: 5 + i, label: "重传" + f, state: "bad" as const }))] }], metrics: [{ label: "重传帧数", value: w, tone: "bad" }] });
      specs.push({ type: "DONE", narration: `确认到帧 4，窗口滑到末尾，发送完成`, views: [{ kind: "chips", label: "各帧状态", items: frames.map((f) => ({ text: String(f), state: "done" as const })) }], metrics: [{ label: "总帧数", value: 5 }, { label: "重传", value: w }] });
      return buildSimulation(base.meta, input, specs, []);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 15. ARP 解析 ---------------- */
const arp: GenericModuleDef<any> = (() => {
  const base = M("net.arp", "net", "ARP 解析与帧的目的 MAC",
    "同网段直接问主机，跨网段只问网关，目的 MAC 因此不同。",
    "ARP 只解析下一跳，不解析最终主机",
    [
      { key: "dst", label: "目的 IP", type: "select" as const, options: [
        { value: "192.168.10.50", label: "192.168.10.50（同网段）" },
        { value: "192.168.20.50", label: "192.168.20.50（跨网段）" },
      ] },
    ]);
  interface Input { dst: string }
  return {
    ...base,
    defaultInput: { dst: "192.168.20.50" } as Input,
    simulate(input: Input) {
      const same = input.dst.startsWith("192.168.10.");
      const target = same ? input.dst : "192.168.10.1";
      const specs: FrameSpec[] = [
        { type: "DECIDE", narration: same ? `目的 ${input.dst} 与本机同网段 → 直接投递` : `目的 ${input.dst} 跨网段 → 交给网关`, views: [{ kind: "fields", items: [{ text: "192.168.10.10/24", sub: "本机" }, { text: input.dst, sub: "目的 IP", state: "active" }] }] },
        { type: "ARP_REQUEST", narration: `广播 ARP 请求：谁是 ${target}？请告诉我你的 MAC`, views: [{ kind: "timeline", label: "ARP 交互", span: 4, segments: [{ start: 0, end: 1, label: "广播请求", state: "warn" }] }] },
        { type: "ARP_REPLY", narration: `${target} 单播回复：我的 MAC 是 aa:bb:cc:00:00:0${same ? 3 : 2}`, views: [{ kind: "timeline", label: "ARP 交互", span: 4, segments: [{ start: 0, end: 1, label: "广播请求", state: "warn" }, { start: 1, end: 2, label: "单播回复", state: "done" }] }] },
        { type: "FRAME", narration: same ? "封装以太网帧：目的 MAC 就是目标主机" : "封装以太网帧：目的 MAC 是网关，不是最终主机", views: [{ kind: "fields", items: [{ text: "aa:bb:cc:00:00:0" + (same ? 3 : 2), sub: "目的 MAC", state: "active" }, { text: input.dst, sub: "目的 IP" }] }], metrics: [{ label: "下一跳", value: target }, { label: "目的 MAC", value: same ? "主机" : "网关" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  } satisfies GenericModuleDef<any>;
})();

export const batch3 = { banker, semaphore, diskScheduling, inode, crc, gbn, arp };