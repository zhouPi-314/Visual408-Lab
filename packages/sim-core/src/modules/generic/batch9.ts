import type { FieldDef } from "../../view";
import type { GenericModuleDef } from "../../view";
import type { Issue } from "../../protocol";
import { bad, buildSimulation, type FrameSpec } from "./kit";

const M = (id: string, subject: "os" | "net", title: string, summary: string, takeaway: string, fields: FieldDef[]) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  summary,
  takeaway,
  fields,
});

/* 9. 多级反馈队列 */
const mlfq: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.mlfq", "os", "多级反馈队列调度", "新进程进高优先级队列，用完时间片就降级，长作业自然下沉。", "短作业优先响应，长作业不被饿死",
      [{ key: "ticks", label: "观察时长（时间片）", type: "select" as const, options: [4, 8, 12].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "短作业", patch: { ticks: "4" } }, { label: "长作业", patch: { ticks: "12" } }],
  };
  return {
    ...base,
    defaultInput: { ticks: "8" },
    simulate(input: any) {
      const total = Number(input.ticks);
      const procs = [
        { id: "P1", q: 1, left: 3 },
        { id: "P2", q: 1, left: 6 },
        { id: "P3", q: 2, left: 2 },
      ];
      const specs: FrameSpec[] = [];
      const qs = () => [1, 2, 3].map((q) => ({ text: procs.filter((p) => p.q === q && p.left > 0).map((p) => p.id).join(" ") || "—", sub: "队列" + q, state: q === 1 ? ("active" as const) : ("idle" as const) }));
      let t = 0;
      while (t < total) {
        const cand = procs.filter((p) => p.left > 0).sort((a, b) => a.q - b.q)[0];
        if (!cand) break;
        const slice = cand.q === 1 ? 2 : 4;
        const run = Math.min(slice, cand.left, total - t);
        cand.left -= run;
        t += run;
        const demoted = cand.left > 0 && cand.q < 3;
        if (demoted) cand.q += 1;
        specs.push({
          type: "RUN",
          narration: `第 ${t} 个时间片：${cand.id}（Q${cand.q}）运行 ${run}，剩余 ${cand.left}${demoted ? " → 降级到 Q" + cand.q : ""}`,
          views: [{ kind: "chips", label: "就绪队列", items: qs() }, { kind: "timeline", label: "CPU 分配", span: total, segments: [{ start: t - run, end: t, label: cand.id, state: "active" }] }],
          metrics: [{ label: "已用时间", value: t }],
        });
      }
      specs.push({ type: "DONE", narration: `${total} 个时间片后：${procs.map((p) => p.id + "剩" + p.left).join("、")}`, views: [{ kind: "chips", label: "队列状态", items: qs() }], metrics: [{ label: "完成", value: procs.filter((p) => p.left === 0).length }] });
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 10. 死锁检测 */
const deadlockDetect: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.deadlock-detect", "os", "死锁检测与资源分配图", "资源分配图出现环，且每类资源只有一个实例 → 死锁。", "有环不一定死锁，要看实例数",
      [{ key: "case_", label: "场景", type: "select" as const, options: [{ value: "dead", label: "循环等待（死锁）" }, { value: "safe", label: "有环但可解" }] }]),
    presets: [{ label: "形成死锁", patch: { case_: "dead" } }, { label: "可解环", patch: { case_: "safe" } }],
  };
  return {
    ...base,
    defaultInput: { case_: "dead" },
    simulate(input: any) {
      const dead = input.case_ === "dead";
      const edges = dead
        ? [["P0", "R0"], ["R0", "P1"], ["P1", "R1"], ["R1", "P0"]]
        : [["P0", "R0"], ["R0", "P1"], ["P1", "R1"], ["R1", "P2"]];
      const specs: FrameSpec[] = [
        { type: "GRAPH", narration: `资源分配图：${edges.map(([a, b]) => a + "→" + b).join("  ")}`, views: [{ kind: "chips", label: "结点", items: [...new Set(edges.flat())].map((x) => ({ text: x, state: "idle" as const })) }] },
        { type: "CYCLE", narration: dead ? "P0→R0→P1→R1→P0 存在环" : "P0→R0→P1→R1→P2 无环", views: [{ kind: "timeline", label: "等待链", span: edges.length, segments: edges.map(([a, b], i) => ({ start: i, end: i + 1, label: a + "→" + b, state: dead ? ("bad" as const) : ("warn" as const) })) }] },
        { type: "DONE", narration: dead ? "每类资源仅 1 个实例且存在环 → 死锁" : "环外还有进程能释放资源 → 不会死锁", views: [{ kind: "fields", items: [{ text: dead ? "是" : "否", sub: "死锁", state: dead ? "bad" : "ok" }] }], metrics: [{ label: "死锁", value: dead ? "是" : "否", tone: dead ? "bad" : "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 11. 段页式 */
const segmentPage: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.segment-page", "os", "段页式地址转换", "先查段表得页表基址，再查页表得页框号。", "两次查表，段页式兼顾两者优点",
      [{ key: "addr", label: "逻辑地址（段号:页号:页内偏移）", type: "text" as const }]),
    presets: [{ label: "段1 页2 偏移64", patch: { addr: "1:2:64" } }, { label: "段0 页1 偏移8", patch: { addr: "0:1:8" } }],
  };
  return {
    ...base,
    defaultInput: { addr: "1:2:64" },
    simulate(input: any) {
      const parts = String(input.addr).split(":").map(Number);
      const seg = parts[0] ?? -1;
      const page = parts[1] ?? -1;
      const off = parts[2] ?? -1;
      const issues: Issue[] = [];
      if (![seg, page, off].every((x) => Number.isInteger(x) && x >= 0)) issues.push(bad("addr", "格式应为 段号:页号:偏移"));
      const SEG = [{ ptab: 100 }, { ptab: 200 }];
      const PTAB: Record<number, number[]> = { 100: [7, 9, 3], 200: [5, 8, 4] };
      const ptabBase = SEG[seg]?.ptab;
      const frame = ptabBase !== undefined ? PTAB[ptabBase]?.[page] : undefined;
      const phys = frame !== undefined ? frame * 1024 + off : undefined;
      const specs: FrameSpec[] = [
        { type: "SEG", narration: `段号 ${seg} → 段表项，页表基址 ${ptabBase}`, views: [{ kind: "grid", label: "段表", columns: ["页表基址"], rowHeaders: ["段0", "段1"], rows: [[{ text: "100" }], [{ text: "200" }]], activeRow: seg }] },
        { type: "PAGE", narration: frame === undefined ? "页号越界 → 越界中断" : `页号 ${page} → 页框号 ${frame}`, views: [{ kind: "grid", label: `页表（基址 ${ptabBase}）`, columns: ["页0", "页1", "页2"], rows: [[...(PTAB[ptabBase!] ?? []).map((f) => ({ text: String(f), state: "active" as const }))]], activeRow: 0 }] },
        { type: "DONE", narration: frame === undefined ? "访问非法" : `物理地址 = ${frame}×1024 + ${off} = ${phys}`, views: [{ kind: "fields", items: [{ text: String(phys ?? "—"), sub: "物理地址", state: frame === undefined ? "bad" : "done" }] }], metrics: [{ label: "物理地址", value: phys ?? "越界", tone: frame === undefined ? "bad" : "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 12. I/O 缓冲 */
const ioBuffer: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.io-buffer", "os", "单缓冲 / 双缓冲 / 缓冲池", "缓冲把磁盘与 CPU 的时间重叠起来。", "双缓冲让传输与处理并行",
      [{ key: "mode", label: "缓冲方式", type: "select" as const, options: [{ value: "none", label: "无缓冲" }, { value: "single", label: "单缓冲" }, { value: "double", label: "双缓冲" }] }]),
    presets: [{ label: "无缓冲", patch: { mode: "none" } }, { label: "双缓冲", patch: { mode: "double" } }],
  };
  return {
    ...base,
    defaultInput: { mode: "double" },
    simulate(input: any) {
      const mode = input.mode;
      const T = 4, C = 2; // 传输/处理时间
      const perBlock = mode === "none" ? T + C : mode === "single" ? Math.max(T, C) + 2 : Math.max(T, C);
      const total = perBlock * 3;
      const segs = Array.from({ length: 3 }, (_, i) => ({
        start: i * perBlock,
        end: i * perBlock + (mode === "none" ? T : Math.min(T, perBlock)),
        label: "T" + i,
        state: "warn" as const,
      }));
      const specs: FrameSpec[] = [
        { type: "MODE", narration: mode === "none" ? "无缓冲：先传完再处理，串行" : mode === "single" ? "单缓冲：传输与处理部分重叠" : "双缓冲：一块在传、一块在处理", views: [{ kind: "timeline", label: "3 个数据块", span: total, segments: segs }] },
        { type: "DONE", narration: `每块平均耗时 ${perBlock}，3 块共 ${total}`, views: [{ kind: "bars", label: "每块耗时", max: T + C, items: [{ label: "无缓冲", value: T + C, state: "bad" }, { label: "单缓冲", value: Math.max(T, C) + 2, state: "warn" }, { label: "双缓冲", value: Math.max(T, C), state: "done" }] }], metrics: [{ label: "每块耗时", value: perBlock }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 13. TCP 拥塞控制 */
const congestion: GenericModuleDef<any> = (() => {
  const base = {
    ...M("net.tcp-congestion", "net", "TCP 拥塞控制", "慢启动指数增长，到阈值后线性增长，丢包就减半。", "cwnd 决定在途字节上限",
      [{ key: "rounds", label: "观察轮次", type: "select" as const, options: [4, 8].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "4 轮慢启动", patch: { rounds: "4" } }, { label: "8 轮", patch: { rounds: "8" } }],
  };
  return {
    ...base,
    defaultInput: { rounds: "8" },
    simulate(input: any) {
      const rounds = Number(input.rounds);
      const ssthresh = 8;
      let cwnd = 1;
      const points: number[] = [];
      for (let r = 1; r <= rounds; r++) {
        points.push(cwnd);
        if (cwnd < ssthresh) cwnd = Math.min(cwnd * 2, ssthresh);
        else cwnd += 1;
      }
      const specs: FrameSpec[] = [
        { type: "SLOW", narration: `慢启动：cwnd 从 1 开始翻倍，直到阈值 ${ssthresh}`, views: [{ kind: "bars", label: "cwnd（MSS）", max: Math.max(...points, ssthresh + 2), items: points.map((c, i) => ({ label: "R" + (i + 1), value: c, state: c < ssthresh ? ("active" as const) : ("done" as const) })) }], metrics: [{ label: "阈值", value: ssthresh }] },
        { type: "CA", narration: "超过阈值 → 拥塞避免：每轮只加 1", views: [{ kind: "bars", label: "cwnd 变化", max: Math.max(...points, ssthresh + 2), items: points.map((c, i) => ({ label: "R" + (i + 1), value: c, state: c >= ssthresh ? ("done" as const) : ("active" as const) })) }] },
        { type: "LOSS", narration: `检测到丢包：ssthresh 减半为 ${Math.max(1, Math.floor(ssthresh / 2))}，cwnd 回到 1`, views: [{ kind: "fields", items: [{ text: String(Math.max(1, Math.floor(ssthresh / 2))), sub: "新阈值", state: "bad" }, { text: "1", sub: "cwnd" }] }], metrics: [{ label: "第 " + rounds + " 轮 cwnd", value: points[points.length - 1]! }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 14. socket 调用顺序 */
const socketApi: GenericModuleDef<any> = (() => {
  const base = {
    ...M("net.socket-api", "net", "TCP socket 调用顺序", "服务端先 listen 再 accept，客户端 connect 触发三次握手。", "accept 只是取出已完成连接的套接字",
      [{ key: "role", label: "视角", type: "select" as const, options: [{ value: "server", label: "服务端" }, { value: "client", label: "客户端" }] }]),
    presets: [{ label: "服务端", patch: { role: "server" } }, { label: "客户端", patch: { role: "client" } }],
  };
  return {
    ...base,
    defaultInput: { role: "server" },
    simulate(input: any) {
      const server = input.role === "server";
      const steps = server
        ? [["socket", "创建监听套接字"], ["bind", "绑定地址与端口"], ["listen", "进入监听（等待队列）"], ["accept", "取出已完成连接的套接字"], ["recv/send", "读写数据"], ["close", "关闭连接"]]
        : [["socket", "创建套接字"], ["connect", "发起连接（三次握手）"], ["send/recv", "读写数据"], ["close", "关闭连接"]];
      const specs: FrameSpec[] = steps.map(([call, desc], i) => ({
        type: call!.toUpperCase(),
        narration: `${server ? "服务端" : "客户端"}第 ${i + 1} 步：${call}() —— ${desc}`,
        views: [{ kind: "timeline", label: "调用序列", span: steps.length, segments: steps.map(([c], k) => ({ start: k, end: k + 1, label: c!, state: k < i ? ("done" as const) : k === i ? ("active" as const) : ("idle" as const) })) }],
        metrics: [{ label: "当前步骤", value: i + 1 }],
      }));
      specs.push({
        type: "DONE",
        narration: `${server ? "服务端" : "客户端"}共 ${steps.length} 个关键调用`,
        views: [{ kind: "chips", label: "调用链", items: steps.map(([c]) => ({ text: c!, state: "done" as const })) }],
        metrics: [{ label: "调用数", value: steps.length }],
      });
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 15. IP 分片 */
const ipFragment: GenericModuleDef<any> = (() => {
  const base = {
    ...M("net.ip-fragment", "net", "IP 分片计算", "MTU 决定每片能带多少数据，分片偏移以 8 字节为单位。", "片偏移 = 数据字节数 / 8",
      [
        { key: "mtu", label: "MTU", type: "select" as const, options: [1500, 576].map((v) => ({ value: String(v), label: String(v) })) },
        { key: "len", label: "IP 数据报总长（字节）", type: "select" as const, options: [2000, 4000, 600].map((v) => ({ value: String(v), label: String(v) })) },
      ]),
    presets: [{ label: "2000 / MTU1500", patch: { mtu: "1500", len: "2000" } }, { label: "4000 / MTU576", patch: { mtu: "576", len: "4000" } }],
  };
  return {
    ...base,
    defaultInput: { mtu: "1500", len: "2000" },
    simulate(input: any) {
      const mtu = Number(input.mtu), total = Number(input.len);
      const dataMax = Math.floor((mtu - 20) / 8) * 8;
      const payload = total - 20;
      const n = Math.ceil(payload / dataMax);
      const frags = Array.from({ length: n }, (_, i) => {
        const off = i * dataMax;
        const len = Math.min(dataMax, payload - off);
        return { i, off: off / 8, len, mf: i < n - 1 };
      });
      const specs: FrameSpec[] = [
        { type: "HEADER", narration: `总长 ${total}，去掉 20 字节首部 → 数据 ${payload} 字节`, views: [{ kind: "fields", items: [{ text: String(total), sub: "总长" }, { text: "20", sub: "首部" }, { text: String(payload), sub: "数据" }] }] },
        { type: "SLICE", narration: `MTU ${mtu} → 每片最多 ${dataMax} 字节数据（须为 8 的倍数）`, views: [{ kind: "fields", items: [{ text: String(dataMax), sub: "单片数据上限", state: "active" }] }], metrics: [{ label: "分片数", value: n }] },
        { type: "FRAGS", narration: `分成 ${n} 片：偏移 ${frags.map((f) => f.off).join(" / ")}`, views: [{ kind: "grid", label: "分片表", columns: ["数据长度", "片偏移（×8B）", "MF"], rows: frags.map((f) => [{ text: String(f.len) }, { text: String(f.off) }, { text: f.mf ? "1" : "0", state: f.mf ? ("warn" as const) : ("idle" as const) }]) }] },
        { type: "DONE", narration: `共 ${n} 片，最后一片 MF=0 表示结束`, views: [{ kind: "bars", label: "各片数据长度", max: dataMax, items: frags.map((f) => ({ label: "片" + (f.i + 1), value: f.len, state: "done" as const })) }], metrics: [{ label: "分片数", value: n }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch9 = { mlfq, deadlockDetect, segmentPage, ioBuffer, congestion, socketApi, ipFragment };