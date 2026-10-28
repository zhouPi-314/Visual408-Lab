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

/* 9. 分区分配 */
const partition: GenericModuleDef<any> = (() => {
  const PARTS = [100, 500, 200, 300];
  const base = M("os.memory-partition", "os", "动态分区：首次 / 最佳 / 最坏适应", "同样的空闲分区，三种策略选中的分区不同。", "最佳适应会留下大量小碎片",
    [
      { key: "size", label: "请求大小", type: "select", options: [150, 120, 280].map((v) => ({ value: String(v), label: String(v) })) },
      { key: "alg", label: "算法", type: "select", options: [{ value: "first", label: "首次适应" }, { value: "best", label: "最佳适应" }, { value: "worst", label: "最坏适应" }] },
    ]);
  return {
    ...base,
    defaultInput: { size: "150", alg: "best" },
    simulate(input: any) {
      const need = Number(input.size);
      const fits = PARTS.map((v, i) => ({ v, i })).filter((x) => x.v >= need);
      if (fits.length === 0) return { input, meta: base.meta, frames: [], validate: () => [bad("size", "没有足够大的空闲分区")] };
      const pick = input.alg === "first" ? fits[0]! : input.alg === "best" ? fits.reduce((a, b) => (b.v < a.v ? b : a)) : fits.reduce((a, b) => (b.v > a.v ? b : a));
      const specs: FrameSpec[] = [
        { type: "LIST", narration: `空闲分区：${PARTS.join(", ")}，请求 ${need}`, views: [{ kind: "chips", label: "空闲分区", items: PARTS.map((v, i) => ({ text: String(v), sub: "#" + i, state: v >= need ? "active" as const : "idle" as const })) }] },
        { type: "CHOOSE", narration: `${input.alg === "first" ? "首次适应：选第一个够大的" : input.alg === "best" ? "最佳适应：选够用的最小分区" : "最坏适应：选最大的分区"} → #${pick.i}（${pick.v}）`, views: [{ kind: "chips", label: "空闲分区", items: PARTS.map((v, i) => ({ text: String(v), sub: "#" + i, state: i === pick.i ? "done" as const : v >= need ? "active" as const : "idle" as const })) }], metrics: [{ label: "选中分区", value: "#" + pick.i, tone: "good" }] },
        { type: "SPLIT", narration: `分配 ${need}，剩余 ${pick.v - need} 成为新空闲块`, views: [{ kind: "chips", label: "分配后", items: PARTS.flatMap((v, i) => i === pick.i ? [{ text: String(v - need), sub: "剩余", state: "warn" as const }] : [{ text: String(v), sub: "#" + i }]) }], metrics: [{ label: "内碎片", value: 0 }, { label: "剩余", value: pick.v - need }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 10. 段式地址转换 */
const segment: GenericModuleDef<any> = (() => {
  const TABLE = [{ base: 1000, len: 400 }, { base: 2000, len: 300 }, { base: 5000, len: 100 }];
  const base = M("os.segment", "os", "段式存储的地址转换", "段号查段表，基址 + 偏移，偏移超长则越界中断。", "段是逻辑单位，长度可变",
    [
      { key: "seg", label: "段号", type: "select", options: [0, 1, 2].map((v) => ({ value: String(v), label: "段 " + v })) },
      { key: "offset", label: "段内偏移", type: "text" },
    ]);
  return {
    ...base,
    defaultInput: { seg: "1", offset: "150" },
    simulate(input: any) {
      const issues: Issue[] = [];
      const s = Number(input.seg), off = Number(input.offset);
      if (!Number.isInteger(off) || off < 0) issues.push(bad("offset", "偏移需为非负整数"));
      const entry = TABLE[s]!;
      const okSeg = off < entry.len;
      const phys = entry.base + off;
      const specs: FrameSpec[] = [
        { type: "TABLE", narration: `段表：${TABLE.map((e, i) => `段${i}(${e.base},${e.len})`).join(" ")}`, views: [{ kind: "grid", label: "段表", columns: ["基址", "长度"], rowHeaders: ["段0", "段1", "段2"], rows: TABLE.map((e) => [{ text: String(e.base) }, { text: String(e.len) }]), activeRow: s }] },
        { type: "CHECK", narration: okSeg ? `偏移 ${off} < 段长 ${entry.len} → 合法` : `偏移 ${off} ≥ 段长 ${entry.len} → 越界中断`, views: [{ kind: "fields", items: [{ text: String(s), sub: "段号" }, { text: String(off), sub: "偏移", state: okSeg ? "done" : "bad" }, { text: String(entry.len), sub: "段长" }] }] },
        { type: "DONE", narration: okSeg ? `物理地址 = ${entry.base} + ${off} = ${phys}` : "访问越界，进程收到段错误", views: [{ kind: "fields", items: [{ text: okSeg ? String(phys) : "—", sub: "物理地址", state: okSeg ? "active" : "bad" }] }], metrics: [{ label: "物理地址", value: okSeg ? phys : "越界", tone: okSeg ? "good" : "bad" }] },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  };
})();

/* 11. 文件物理结构 */
const fileAlloc: GenericModuleDef<any> = (() => {
  const base = M("os.file-allocate", "os", "文件物理结构：连续 / 链接 / 索引", "同样 5 个盘块，三种结构的寻址次数与碎片差别很大。", "索引分配用一次额外访存换随机访问",
    [
      { key: "blocks", label: "文件块数", type: "select", options: [5, 20].map((v) => ({ value: String(v), label: String(v) })) },
    ]);
  return {
    ...base,
    defaultInput: { blocks: "5" },
    simulate(input: any) {
      const n = Number(input.blocks);
      const specs: FrameSpec[] = [
        { type: "CONTIG", narration: `连续分配：查目录得到起始块号，第 k 块地址 = 起始 + k，寻址 1 次`, views: [{ kind: "bars", label: "访问第 k 块需要的磁盘 I/O", max: n + 1, items: [{ label: "连续", value: 1, state: "done" }] }], metrics: [{ label: "寻址次数", value: 1 }, { label: "外部碎片", value: "有", tone: "bad" }] },
        { type: "LINKED", narration: `链接分配：每块存下一块指针，访问第 k 块要顺链走 ${n} 次`, views: [{ kind: "chips", label: "块链", items: Array.from({ length: n }, (_, i) => ({ text: "B" + i, sub: "→B" + (i + 1), state: "idle" as const })) }, { kind: "bars", label: "访问第 k 块需要的磁盘 I/O", max: n + 1, items: [{ label: "连续", value: 1, state: "done" }, { label: "链接", value: n, state: "warn" }] }], metrics: [{ label: "寻址次数", value: n, tone: "bad" }, { label: "外部碎片", value: "无", tone: "good" }] },
        { type: "INDEXED", narration: `索引分配：索引块存全部块号，访问 = 读索引 + 读数据 = 2 次`, views: [{ kind: "chips", label: "索引块", items: Array.from({ length: n }, (_, i) => ({ text: "B" + i, state: "done" as const })) }, { kind: "bars", label: "访问第 k 块需要的磁盘 I/O", max: n + 1, items: [{ label: "连续", value: 1, state: "done" }, { label: "链接", value: n, state: "warn" }, { label: "索引", value: 2, state: "active" }] }], metrics: [{ label: "寻址次数", value: 2 }, { label: "支持随机访问", value: "是", tone: "good" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 12. 中断处理 */
const interrupt: GenericModuleDef<any> = (() => {
  const base = M("os.interrupt", "os", "中断处理流程", "关中断 → 保存断点 → 识别中断源 → 处理 → 恢复。", "中断屏蔽字决定响应顺序",
    [{ key: "kind", label: "中断类型", type: "select", options: [{ value: "io", label: "I/O 完成" }, { value: "clock", label: "时钟" }, { value: "fault", label: "故障（缺页）" }] }]);
  return {
    ...base,
    defaultInput: { kind: "io" },
    simulate(input: any) {
      const label = input.kind === "io" ? "I/O 完成" : input.kind === "clock" ? "时钟中断" : "缺页故障";
      const specs: FrameSpec[] = [
        { type: "DISABLE", narration: `${label}：硬件关中断，防止嵌套打断`, views: [{ kind: "timeline", label: "中断处理", span: 5, segments: [{ start: 0, end: 1, label: "关中断", state: "warn" }] }] },
        { type: "SAVE", narration: "保存现场：PC、PSW、通用寄存器压栈", views: [{ kind: "timeline", label: "中断处理", span: 5, segments: [{ start: 0, end: 1, label: "关中断", state: "done" }, { start: 1, end: 2, label: "保存现场", state: "active" }] }] },
        { type: "IDENTIFY", narration: "识别中断源：查询中断向量表，取服务程序入口", views: [{ kind: "timeline", label: "中断处理", span: 5, segments: [{ start: 0, end: 1, label: "关中断", state: "done" }, { start: 1, end: 2, label: "保存现场", state: "done" }, { start: 2, end: 3, label: "识别", state: "active" }] }] },
        { type: "SERVICE", narration: `执行${label}服务程序`, views: [{ kind: "timeline", label: "中断处理", span: 5, segments: [{ start: 0, end: 1, label: "关中断", state: "done" }, { start: 1, end: 2, label: "保存现场", state: "done" }, { start: 2, end: 3, label: "识别", state: "done" }, { start: 3, end: 4, label: "服务", state: "active" }] }] },
        { type: "RESTORE", narration: "恢复现场并开中断，返回被中断的指令继续执行", views: [{ kind: "timeline", label: "中断处理", span: 5, segments: [{ start: 0, end: 1, label: "关中断", state: "done" }, { start: 1, end: 2, label: "保存现场", state: "done" }, { start: 2, end: 3, label: "识别", state: "done" }, { start: 3, end: 4, label: "服务", state: "done" }, { start: 4, end: 5, label: "恢复", state: "ok" }] }], metrics: [{ label: "类型", value: label }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 13. CSMA/CD 退避 */
const csma: GenericModuleDef<any> = (() => {
  const base = M("net.csma-cd", "net", "CSMA/CD 与二进制指数退避", "冲突次数 k 决定随机等待 0..2^k−1 个争用期。", "重传次数越多，等待窗口越大",
    [
      { key: "stations", label: "站点数", type: "select", options: [4, 8, 16].map((v) => ({ value: String(v), label: String(v) })) },
      { key: "k", label: "第几次冲突（k）", type: "select", options: [0, 1, 2, 3, 4].map((v) => ({ value: String(v), label: String(v) })) },
    ]);
  return {
    ...base,
    defaultInput: { stations: "8", k: "2" },
    simulate(input: any) {
      const n = Number(input.stations), k = Math.min(Number(input.k), 10);
      const slots = Math.pow(2, k);
      const maxSlots = Math.min(slots, 1024);
      const specs: FrameSpec[] = [
        { type: "LISTEN", narration: `${n} 个站点共享总线：先听后发`, views: [{ kind: "chips", label: "站点", items: Array.from({ length: n }, (_, i) => ({ text: "S" + i })) }] },
        { type: "COLLIDE", narration: "两个站点同时发送 → 冲突，信号叠加后各自停止", views: [{ kind: "timeline", label: "总线", span: 8, segments: [{ start: 0, end: 2, label: "发送", state: "bad" }, { start: 2, end: 3, label: "冲突", state: "warn" }] }] },
        { type: "BACKOFF", narration: `第 ${k} 次冲突：从 0..${maxSlots - 1} 中随机取一个争用期等待`, views: [{ kind: "bars", label: "可选等待槽位", max: Math.max(maxSlots, 1), items: [{ label: "槽位上限", value: maxSlots, state: "active" }] }], metrics: [{ label: "退避窗口", value: maxSlots }] },
        { type: "RETRY", narration: `等待后重发；连续冲突 16 次则丢弃该帧`, views: [{ kind: "fields", items: [{ text: String(k), sub: "冲突次数" }, { text: String(maxSlots), sub: "退避窗口" }, { text: maxSlots > 1 ? "指数增长" : "首次重传", sub: "规律", state: "active" }] }], metrics: [{ label: "退避窗口", value: maxSlots }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 14. NAT */
const nat: GenericModuleDef<any> = (() => {
  const base = M("net.nat", "net", "NAT 地址转换表", "多台内网主机共用一个公网 IP，靠端口号区分连接。", "NAT 改的是源 IP 与源端口",
    [{ key: "hosts", label: "内网主机数", type: "select", options: [2, 3, 4].map((v) => ({ value: String(v), label: String(v) })) }]);
  return {
    ...base,
    defaultInput: { hosts: "2" },
    simulate(input: any) {
      const n = Number(input.hosts);
      const rows = Array.from({ length: n }, (_, i) => ({ priv: `192.168.1.${10 + i}:5000`, pub: `203.0.113.5:${40000 + i}`, dst: "8.8.8.8:53" }));
      const specs: FrameSpec[] = [
        { type: "OUT", narration: `${n} 台内网主机同时访问 8.8.8.8:53`, views: [{ kind: "grid", label: "NAT 转换表", columns: ["内网", "公网", "目的"], rows: rows.map((r) => [{ text: r.priv }, { text: r.pub, state: "active" as const }, { text: r.dst }]) }] },
        { type: "REWRITE", narration: "出口路由器改写源地址与端口，记录映射", views: [{ kind: "fields", items: rows.map((r) => ({ text: r.pub, sub: r.priv, state: "done" as const })) }] },
        { type: "REPLY", narration: "回包按表还原成内网地址，交回对应主机", views: [{ kind: "grid", label: "回包还原", columns: ["公网目的", "还原为"], rows: rows.map((r) => [{ text: r.pub }, { text: r.priv, state: "done" as const }]) }], metrics: [{ label: "映射条目", value: n }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

/* 15. DNS 查询 */
const dns: GenericModuleDef<any> = (() => {
  const base = M("net.dns-resolve", "net", "DNS：递归查询 vs 迭代查询", "递归由本地服务器代劳，迭代要主机自己逐级问。", "递归查询对主机最省事",
    [{ key: "mode", label: "查询方式", type: "select", options: [{ value: "recursive", label: "递归查询" }, { value: "iterative", label: "迭代查询" }] }]);
  return {
    ...base,
    defaultInput: { mode: "iterative" },
    simulate(input: any) {
      const recursive = input.mode === "recursive";
      const specs: FrameSpec[] = recursive
        ? [
            { type: "ASK", narration: "主机 → 本地 DNS：请帮我解析 www.example.com", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "主机→本地", state: "active" }] }] },
            { type: "LOCAL", narration: "本地 DNS 依次询问根、顶级、权威服务器（主机不参与）", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "主机→本地", state: "done" }, { start: 1, end: 3, label: "本地代问", state: "warn" }] }] },
            { type: "REPLY", narration: "本地 DNS 把最终 IP 返回主机", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "主机→本地", state: "done" }, { start: 1, end: 3, label: "本地代问", state: "done" }, { start: 3, end: 4, label: "返回 IP", state: "ok" }] }], metrics: [{ label: "主机发起查询", value: 1 }] },
          ]
        : [
            { type: "ROOT", narration: "主机 → 根服务器：返回 .com 顶级服务器地址", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "问根", state: "active" }] }] },
            { type: "TLD", narration: "主机 → .com 顶级服务器：返回 example.com 权威服务器", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "问根", state: "done" }, { start: 1, end: 2, label: "问顶级", state: "active" }] }] },
            { type: "AUTH", narration: "主机 → 权威服务器：得到 www.example.com 的 A 记录", views: [{ kind: "timeline", label: "查询过程", span: 4, segments: [{ start: 0, end: 1, label: "问根", state: "done" }, { start: 1, end: 2, label: "问顶级", state: "done" }, { start: 2, end: 3, label: "问权威", state: "active" }] }], metrics: [{ label: "主机发起查询", value: 3 }] },
          ];
      return buildSimulation(base.meta, input, specs, []);
    },
  };
})();

export const batch5 = { partition, segment, fileAlloc, interrupt, csma, nat, dns };