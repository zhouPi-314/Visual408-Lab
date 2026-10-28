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

/* 9. 缺页处理 */
const pageFault: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.page-fault", "os", "缺页异常的处理流程", "缺页不是错误：操作系统把页调入后重新执行那条指令。", "脏页换出会多一次磁盘 I/O",
      [{ key: "dirty", label: "牺牲页是否被修改", type: "select" as const, options: [{ value: "clean", label: "未修改（干净页）" }, { value: "dirty", label: "已修改（脏页）" }] }]),
    presets: [{ label: "干净页", patch: { dirty: "clean" } }, { label: "脏页", patch: { dirty: "dirty" } }],
  };
  return {
    ...base,
    defaultInput: { dirty: "dirty" },
    simulate(input: any) {
      const dirty = input.dirty === "dirty";
      const io = dirty ? 2 : 1;
      const specs: FrameSpec[] = [
        { type: "TRAP", narration: "访问的页不在内存 → 触发缺页异常，进程阻塞", views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "warn" }] }] },
        { type: "LOOKUP", narration: "检查页表项：有效位为 0，确认确实缺页", views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "done" }, { start: 1, end: 2, label: "查页表", state: "active" }] }] },
        { type: "CHOOSE", narration: "内存满 → 选一个牺牲页（按置换算法）", views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "done" }, { start: 1, end: 2, label: "查页表", state: "done" }, { start: 2, end: 3, label: "选牺牲页", state: "active" }] }] },
        ...(dirty ? [{ type: "WRITEBACK", narration: "牺牲页被修改过 → 先写回磁盘（第 1 次 I/O）", views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "done" as const }, { start: 1, end: 2, label: "查页表", state: "done" as const }, { start: 2, end: 3, label: "选牺牲页", state: "done" as const }, { start: 3, end: 4, label: "写回磁盘", state: "warn" as const }] }] }] as FrameSpec[] : []),
        { type: "LOAD", narration: `从磁盘读入所需页（${dirty ? "第 2" : "第 1"} 次 I/O）`, views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "done" }, { start: 1, end: 2, label: "查页表", state: "done" }, { start: 2, end: 3, label: "选牺牲页", state: "done" }, ...(dirty ? [{ start: 3, end: 4, label: "写回磁盘", state: "done" as const }] : []), { start: dirty ? 4 : 3, end: dirty ? 5 : 4, label: "读入缺页", state: "active" }] }] },
        { type: "RESUME", narration: "更新页表与快表，恢复进程并重新执行引发缺页的指令", views: [{ kind: "timeline", label: "缺页处理", span: 7, segments: [{ start: 0, end: 1, label: "陷入内核", state: "done" }, { start: 1, end: 2, label: "查页表", state: "done" }, { start: 2, end: 3, label: "选牺牲页", state: "done" }, ...(dirty ? [{ start: 3, end: 4, label: "写回磁盘", state: "done" as const }] : []), { start: dirty ? 4 : 3, end: dirty ? 5 : 4, label: "读入缺页", state: "done" }, { start: dirty ? 5 : 4, end: 7, label: "更新页表/重执行", state: "ok" }] }], metrics: [{ label: "磁盘 I/O", value: io, tone: dirty ? "bad" : "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 10. 抖动 */
const thrashing: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.thrashing", "os", "工作集与抖动", "分配的页框少于工作集，缺页率飙升，CPU 利用率反而下降。", "抖动时加内存未必救，要减并发度",
      [{ key: "frames", label: "分配给进程的页框", type: "select" as const, options: [2, 4, 6, 8, 10].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "页框不足", patch: { frames: "4" } }, { label: "页框充足", patch: { frames: "10" } }],
  };
  return {
    ...base,
    defaultInput: { frames: "4" },
    simulate(input: any) {
      const f = Number(input.frames);
      const ws = 8;
      const base0 = 0.05;
      const ratio = Math.min(1, Math.max(0, (ws - f) / ws));
      const fault = Math.min(0.95, base0 + ratio * 0.9);
      const cpu = Math.max(5, 95 - fault * 100);
      const specs: FrameSpec[] = [
        { type: "WS", narration: `进程工作集 ${ws} 页，当前只分到 ${f} 个页框`, views: [{ kind: "bars", label: "页框 vs 工作集", max: ws, items: [{ label: "工作集", value: ws, state: "idle" }, { label: "已分配", value: f, state: f < ws ? "bad" : "done" }] }] },
        { type: "FAULT", narration: `缺页率约 ${(fault * 100).toFixed(0)}%${f < ws ? "（页框不足，频繁换页）" : "（页框充足）"}`, views: [{ kind: "bars", label: "缺页率", max: 100, items: [{ label: "缺页率", value: Number((fault * 100).toFixed(0)), state: f < ws ? "bad" : "done" }] }], metrics: [{ label: "缺页率", value: (fault * 100).toFixed(0) + "%", tone: f < ws ? "bad" : "good" }] },
        { type: "CPU", narration: `CPU 有效利用率约 ${cpu.toFixed(0)}%：缺页时 CPU 只能干等磁盘`, views: [{ kind: "bars", label: "CPU 利用率", max: 100, items: [{ label: "利用率", value: Number(cpu.toFixed(0)), state: cpu < 40 ? "bad" : "done" }] }], metrics: [{ label: "CPU", value: cpu.toFixed(0) + "%" }] },
        { type: "DONE", narration: f < ws ? "判定为抖动：应减少并发进程数或增加页框" : "未抖动：页框足以覆盖工作集", views: [{ kind: "fields", items: [{ text: String(f), sub: "页框" }, { text: String(ws), sub: "工作集" }, { text: f < ws ? "抖动" : "正常", sub: "状态", state: f < ws ? "bad" : "ok" }] }], metrics: [{ label: "状态", value: f < ws ? "抖动" : "正常", tone: f < ws ? "bad" : "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 11. 磁盘地址 CHS→LBA */
const diskLayout: GenericModuleDef<any> = (() => {
  const Hmax = 16, Smax = 63;
  const base = {
    ...M("os.disk-layout", "os", "磁盘地址：柱面 / 磁头 / 扇区", "给定 CHS，算出 LBA；换道代价远大于换扇区。", "LBA = ((C×磁头数)+H)×每道扇区数 + (S−1)",
      [
        { key: "c", label: "柱面 C", type: "text" as const },
        { key: "h", label: "磁头 H", type: "text" as const },
        { key: "s", label: "扇区 S（从 1 开始）", type: "text" as const },
      ]),
    presets: [{ label: "C=0,H=0,S=1", patch: { c: "0", h: "0", s: "1" } }, { label: "C=100,H=3,S=17", patch: { c: "100", h: "3", s: "17" } }],
  };
  return {
    ...base,
    defaultInput: { c: "100", h: "3", s: "17" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const c = Number(input.c), h = Number(input.h), s = Number(input.s);
      if (![c, h, s].every((x) => Number.isInteger(x))) issues.push(bad("c", "三个字段都要整数"));
      if (h < 0 || h >= Hmax) issues.push(bad("h", `磁头范围 0–${Hmax - 1}`));
      if (s < 1 || s > Smax) issues.push(bad("s", `扇区范围 1–${Smax}`));
      const lba = (c * Hmax + h) * Smax + (s - 1);
      const specs: FrameSpec[] = [
        { type: "GEOMETRY", narration: `几何参数：${Hmax} 个磁头/柱面，每道 ${Smax} 个扇区`, views: [{ kind: "fields", items: [{ text: String(Hmax), sub: "磁头数" }, { text: String(Smax), sub: "每道扇区" }] }] },
        { type: "CHS", narration: `位置：柱面 ${c}、磁头 ${h}、扇区 ${s}`, views: [{ kind: "fields", items: [{ text: String(c), sub: "C" }, { text: String(h), sub: "H" }, { text: String(s), sub: "S", state: "active" }] }] },
        { type: "LBA", narration: `LBA = ((${c}×${Hmax})+${h})×${Smax} + (${s}−1) = ${lba}`, views: [{ kind: "fields", items: [{ text: String(lba), sub: "LBA", state: "done" }] }], metrics: [{ label: "LBA", value: lba }] },
        { type: "COST", narration: "换柱面要移动磁臂（毫秒级），换扇区只需等旋转（微秒级）", views: [{ kind: "bars", label: "时间量级（相对）", max: 1000, items: [{ label: "寻道", value: 1000, state: "bad" }, { label: "旋转", value: 8, state: "warn" }, { label: "传输", value: 1, state: "done" }] }], metrics: [{ label: "LBA", value: lba }] },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 12. Peterson 互斥 */
const peterson: GenericModuleDef<any> = (() => {
  const base = {
    ...M("os.peterson", "os", "Peterson 互斥算法", "flag 表示想进，turn 表示让谁先进，两个变量保证互斥。", "仅适用于两个进程，需原子读写",
      [{ key: "order", label: "竞争顺序", type: "select" as const, options: [{ value: "p0", label: "P0 先请求" }, { value: "p1", label: "P1 先请求" }] }]),
    presets: [{ label: "P0 先", patch: { order: "p0" } }, { label: "P1 先", patch: { order: "p1" } }],
  };
  return {
    ...base,
    defaultInput: { order: "p0" },
    simulate(input: any) {
      const first = input.order;
      const other = first === "p0" ? "p1" : "p0";
      const specs: FrameSpec[] = [
        { type: "INIT", narration: "初始：flag=[false,false]，turn=0，谁都不想进临界区", views: [{ kind: "chips", label: "共享变量", items: [{ text: "false", sub: "flag[0]" }, { text: "false", sub: "flag[1]" }, { text: "0", sub: "turn" }] }] },
        { type: "WANT", narration: `${first.toUpperCase()} 想进入：flag=1`, views: [{ kind: "chips", label: "共享变量", items: [{ text: first === "p0" ? "true" : "false", sub: "flag[0]", state: first === "p0" ? "active" as const : "idle" as const }, { text: first === "p1" ? "true" : "false", sub: "flag[1]", state: first === "p1" ? "active" as const : "idle" as const }, { text: "0", sub: "turn" }] }] },
        { type: "YIELD", narration: `${first.toUpperCase()} 把 turn 让给 ${other.toUpperCase()}（turn=${other === "p1" ? 1 : 0}）`, views: [{ kind: "chips", label: "共享变量", items: [{ text: "true", sub: "flag[" + (first === "p0" ? 0 : 1) + "]" }, { text: "false", sub: "flag[" + (other === "p0" ? 0 : 1) + "]" }, { text: String(other === "p1" ? 1 : 0), sub: "turn", state: "active" }] }] },
        { type: "OTHER", narration: `${other.toUpperCase()} 也想进：flag=1 并令 turn=${first === "p1" ? 1 : 0}`, views: [{ kind: "chips", label: "共享变量", items: [{ text: "true", sub: "flag[0]", state: "done" }, { text: "true", sub: "flag[1]", state: "done" }, { text: String(first === "p1" ? 1 : 0), sub: "turn", state: "active" }] }] },
        { type: "ENTER", narration: `${first.toUpperCase()} 检查：flag[对方]=true 但 turn=${first === "p0" ? 0 : 1} 是它自己 → 进入临界区；${other.toUpperCase()} 被挡在循环外`, views: [{ kind: "fields", items: [{ text: first.toUpperCase(), sub: "临界区", state: "done" }, { text: other.toUpperCase(), sub: "等待", state: "warn" }] }], metrics: [{ label: "同时进入", value: 0, tone: "good" }] },
        { type: "EXIT", narration: `${first.toUpperCase()} 退出，flag 置 false；${other.toUpperCase()} 随后进入`, views: [{ kind: "fields", items: [{ text: first.toUpperCase(), sub: "已退出", state: "idle" }, { text: other.toUpperCase(), sub: "临界区", state: "done" }] }], metrics: [{ label: "互斥", value: "成立", tone: "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 13. CIDR 最长前缀匹配 */
const cidrRoute: GenericModuleDef<any> = (() => {
  const TABLE = [
    { net: "10.0.0.0", len: 8, hop: "R1" },
    { net: "10.1.0.0", len: 16, hop: "R2" },
    { net: "10.1.2.0", len: 24, hop: "R3" },
    { net: "0.0.0.0", len: 0, hop: "R0（默认）" },
  ];
  const ipToInt = (ip: string) => ip.split(".").reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
  const base = {
    ...M("net.cidr-route", "net", "路由表与最长前缀匹配", "同一目的地址可能匹配多条路由，选前缀最长的。", "前缀越长越具体，优先于默认路由",
      [{ key: "dst", label: "目的 IP", type: "select" as const, options: ["10.1.2.5", "10.1.9.9", "10.8.8.8", "192.168.1.1"].map((v) => ({ value: v, label: v })) }]),
    presets: [{ label: "命中 /24", patch: { dst: "10.1.2.5" } }, { label: "只命中 /8", patch: { dst: "10.8.8.8" } }, { label: "默认路由", patch: { dst: "192.168.1.1" } }],
  };
  return {
    ...base,
    defaultInput: { dst: "10.1.2.5" },
    simulate(input: any) {
      const dst = String(input.dst);
      const d = ipToInt(dst);
      const matches = TABLE.map((r) => {
        const mask = r.len === 0 ? 0 : (0xffffffff << (32 - r.len)) >>> 0;
        return { ...r, hit: (d & mask) >>> 0 === (ipToInt(r.net) & mask) >>> 0 };
      });
      const best = matches.filter((m) => m.hit).sort((a, b) => b.len - a.len)[0];
      const rows = matches.map((m) => [{ text: `${m.net}/${m.len}` }, { text: m.hop }, { text: m.hit ? "匹配" : "—", state: m.hit ? ("done" as const) : ("idle" as const) }]);
      const specs: FrameSpec[] = [
        { type: "LOOKUP", narration: `查 ${dst}：逐条与掩码相与`, views: [{ kind: "grid", label: "路由表", columns: ["目的网络", "下一跳", "是否匹配"], rows }] },
        { type: "MATCH", narration: `匹配 ${matches.filter((m) => m.hit).length} 条，选前缀最长的 / ${best?.len}`, views: [{ kind: "grid", label: "命中项", columns: ["目的网络", "下一跳", "是否匹配"], rows: rows.map((r, i) => matches[i]!.hit ? r : [{ text: "" }, { text: "" }, { text: "跳过" }]), activeRow: matches.findIndex((m) => m === best) }], metrics: [{ label: "最长前缀", value: "/" + (best?.len ?? "-") }] },
        { type: "FORWARD", narration: `转发给 ${best?.hop}`, views: [{ kind: "fields", items: [{ text: dst, sub: "目的 IP" }, { text: best?.hop ?? "-", sub: "下一跳", state: "active" }] }], metrics: [{ label: "下一跳", value: best?.hop ?? "-" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 14. TCP 流量控制 */
const tcpFlow: GenericModuleDef<any> = (() => {
  const base = {
    ...M("net.tcp-flow-control", "net", "TCP 流量控制与接收窗口", "接收方通过 rwnd 告诉发送方还能收多少，窗口会动态收缩。", "rwnd 为 0 时要等窗口更新",
      [{ key: "rwnd", label: "接收方初始窗口", type: "select" as const, options: [4, 8].map((v) => ({ value: String(v), label: String(v) })) }]),
    presets: [{ label: "窗口 4", patch: { rwnd: "4" } }, { label: "窗口 8", patch: { rwnd: "8" } }],
  };
  return {
    ...base,
    defaultInput: { rwnd: "4" },
    simulate(input: any) {
      const w0 = Number(input.rwnd);
      const specs: FrameSpec[] = [
        { type: "ADVERTISE", narration: `接收方通告 rwnd=${w0}，发送方最多发 ${w0} 个段`, views: [{ kind: "timeline", label: "发送窗口", span: 10, segments: Array.from({ length: w0 }, (_, i) => ({ start: i, end: i + 1, label: "S" + i, state: "active" as const })) }] },
        { type: "SEND", narration: `发送 ${w0} 个段，窗口占满，等待 ACK`, views: [{ kind: "timeline", label: "发送窗口", span: 10, segments: Array.from({ length: w0 }, (_, i) => ({ start: i, end: i + 1, label: "已发" + i, state: "done" as const })) }], metrics: [{ label: "在途", value: w0 }] },
        { type: "SHRINK", narration: "接收方应用读取慢，通告 rwnd 减小到 2", views: [{ kind: "timeline", label: "发送窗口", span: 10, segments: [{ start: 0, end: 2, label: "可发", state: "active" }, { start: 2, end: w0, label: "暂停", state: "idle" }] }], metrics: [{ label: "rwnd", value: 2, tone: "bad" }] },
        { type: "DONE", narration: "应用读走数据后通告 rwnd 增大，窗口恢复", views: [{ kind: "timeline", label: "发送窗口", span: 10, segments: Array.from({ length: w0 }, (_, i) => ({ start: i, end: i + 1, label: "可发" + i, state: "done" as const })) }], metrics: [{ label: "rwnd", value: w0 }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 15. DHCP */
const dhcp: GenericModuleDef<any> = (() => {
  const base = {
    ...M("net.dhcp", "net", "DHCP 的四个报文", "Discover → Offer → Request → ACK，客户端从无到有拿到地址。", "DHCP 基于 UDP，客户端此时还没有 IP",
      [{ key: "relay", label: "是否跨网段", type: "select" as const, options: [{ value: "no", label: "同一网段（广播）" }, { value: "yes", label: "跨网段（中继）" }] }]),
    presets: [{ label: "同网段", patch: { relay: "no" } }, { label: "跨网段", patch: { relay: "yes" } }],
  };
  return {
    ...base,
    defaultInput: { relay: "no" },
    simulate(input: any) {
      const relay = input.relay === "yes";
      const specs: FrameSpec[] = [
        { type: "DISCOVER", narration: "客户端广播 DHCP Discover（源 0.0.0.0，目的 255.255.255.255）", views: [{ kind: "timeline", label: "DORA", span: 4, segments: [{ start: 0, end: 1, label: "Discover", state: "active" }] }] },
        { type: "OFFER", narration: `服务器回应 Offer，提供一个可用地址${relay ? "（经中继转发）" : ""}`, views: [{ kind: "timeline", label: "DORA", span: 4, segments: [{ start: 0, end: 1, label: "Discover", state: "done" }, { start: 1, end: 2, label: "Offer", state: "active" }] }] },
        { type: "REQUEST", narration: "客户端广播 Request，正式请求这个地址", views: [{ kind: "timeline", label: "DORA", span: 4, segments: [{ start: 0, end: 1, label: "Discover", state: "done" }, { start: 1, end: 2, label: "Offer", state: "done" }, { start: 2, end: 3, label: "Request", state: "active" }] }] },
        { type: "ACK", narration: "服务器回 ACK，附带租期与网关/DNS，配置完成", views: [{ kind: "timeline", label: "DORA", span: 4, segments: [{ start: 0, end: 1, label: "Discover", state: "done" }, { start: 1, end: 2, label: "Offer", state: "done" }, { start: 2, end: 3, label: "Request", state: "done" }, { start: 3, end: 4, label: "ACK", state: "ok" }] }], metrics: [{ label: "报文数", value: 4 }, { label: "中继", value: relay ? "需要" : "不需要" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch7 = { pageFault, thrashing, diskLayout, peterson, cidrRoute, tcpFlow, dhcp };