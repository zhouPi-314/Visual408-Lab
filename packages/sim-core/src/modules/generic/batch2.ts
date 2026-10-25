import type { FieldDef } from "../../view";
import type { GenericModuleDef } from "../../view";
import { bad, buildSimulation, intIn, type FrameSpec } from "./kit";

const M = (id: string, subject: "co" | "os" | "net", title: string, summary: string, takeaway: string, fields: FieldDef[]) => ({
  meta: { id, subject, title, syllabusVersion: "2026", references: [{ label: "408 考试大纲 / 本项目原创实现", kind: "original" as const }] },
  summary,
  takeaway,
  fields,
});

/* ---------------- 5. 指令格式与寻址 ---------------- */
const instructionFormat: GenericModuleDef<any> = (() => {
  const base = M("co.instruction-format", "co", "指令格式与字段拆分",
    "把 32 位指令按 opcode/rs/rt/imm 切开，看清一条指令的每个字段。",
    "字段位置固定，寻址方式决定有效地址",
    [{ key: "word", label: "32 位指令（十六进制）", type: "text" as const }]);
  interface Input { word: string }
  return {
    ...base,
    defaultInput: { word: "0x8C220004" } as Input,
    simulate(input: Input) {
      const issues = [];
      const raw = input.word.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]{1,8}$/.test(raw)) issues.push(bad("word", "请输入 1–8 位十六进制"));
      const word = Number.parseInt(raw || "0", 16) >>> 0;
      const bits = word.toString(2).padStart(32, "0").split("").map(Number);
      const op = Number.parseInt(bits.slice(0, 6).join(""), 2);
      const rs = Number.parseInt(bits.slice(6, 11).join(""), 2);
      const rt = Number.parseInt(bits.slice(11, 16).join(""), 2);
      const imm = Number.parseInt(bits.slice(16, 32).join(""), 2);
      const specs: FrameSpec[] = [
        {
          type: "BITS",
          narration: `0x${raw.toUpperCase()} 展开为 32 位`,
          views: [{ kind: "bits", label: "指令字", groups: [{ label: "32 位", bits }] }],
        },
        {
          type: "OPCODE",
          narration: `取高 6 位 opcode = ${op}`,
          views: [
            { kind: "bits", label: "opcode（6 位）", groups: [{ label: "opcode", bits: bits.slice(0, 6), splitAt: 6 }] },
            { kind: "fields", items: [{ text: String(op), sub: "opcode" }] },
          ],
        },
        {
          type: "REGISTERS",
          narration: `rs=${rs}，rt=${rt}（各 5 位）`,
          views: [
            { kind: "fields", items: [
              { text: String(op), sub: "opcode", state: "done" },
              { text: String(rs), sub: "rs", state: "active" },
              { text: String(rt), sub: "rt", state: "active" },
            ] },
            { kind: "bits", label: "寄存器编号", groups: [
              { label: "rs", bits: bits.slice(6, 11) },
              { label: "rt", bits: bits.slice(11, 16) },
            ] },
          ],
        },
        {
          type: "IMMEDIATE",
          narration: `低 16 位立即数 = ${imm}（有符号时 ${imm > 32767 ? imm - 65536 : imm}）`,
          views: [
            { kind: "fields", items: [
              { text: String(op), sub: "opcode", state: "done" },
              { text: String(rs), sub: "rs", state: "done" },
              { text: String(rt), sub: "rt", state: "done" },
              { text: String(imm), sub: "imm", state: "active" },
            ] },
            { kind: "bits", label: "立即数（16 位）", groups: [{ label: "imm", bits: bits.slice(16, 32) }] },
          ],
          metrics: [{ label: "opcode", value: op }, { label: "rs", value: rs }, { label: "rt", value: rt }, { label: "imm", value: imm }],
        },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 6. IEEE 754 浮点数 ---------------- */
const ieee754: GenericModuleDef<any> = (() => {
  const base = M("co.ieee754", "co", "IEEE 754 单精度浮点拆解",
    "符号 1 位 / 阶码 8 位（偏移 127）/ 尾数 23 位，逐段还原真值。",
    "阶码用移码，尾数隐含最高位 1",
    [{ key: "value", label: "十进制数（如 -12.75）", type: "text" as const }]);
  interface Input { value: string }
  return {
    ...base,
    defaultInput: { value: "-12.75" } as Input,
    simulate(input: Input) {
      const issues = [];
      const x = Number(input.value);
      if (!Number.isFinite(x)) issues.push(bad("value", "请输入有限十进制数"));
      const sign = x < 0 ? 1 : 0;
      const abs = Math.abs(x);
      const exp = abs === 0 ? 0 : Math.floor(Math.log2(abs));
      const biased = exp + 127;
      const mantissa = Math.round((abs / 2 ** exp - 1) * 2 ** 23);
      const bits = [sign, ...biased.toString(2).padStart(8, "0").split("").map(Number), ...mantissa.toString(2).padStart(23, "0").split("").map(Number)];
      const specs: FrameSpec[] = [
        { type: "SIGN", narration: `符号位 ${sign}（${sign ? "负数" : "正数"}）`, views: [{ kind: "fields", items: [{ text: String(sign), sub: "符号位", state: "active" }] }] },
        { type: "EXPONENT", narration: `规范化后阶码 = ${exp}，加偏移 127 → ${biased}`, views: [{ kind: "bits", label: "阶码（8 位）", groups: [{ label: `阶码 ${biased}`, bits: bits.slice(1, 9) }] }, { kind: "fields", items: [{ text: String(sign), sub: "符号" }, { text: String(biased), sub: `阶码(${exp}+127)`, state: "active" }] }] },
        { type: "MANTISSA", narration: `尾数 = ${mantissa}（隐含最高位 1.）`, views: [{ kind: "bits", label: "尾数（23 位）", groups: [{ label: "mantissa", bits: bits.slice(9, 32) }] }] },
        {
          type: "ASSEMBLE", narration: `拼成 32 位：1+8+23，还原真值 ${x}`,
          views: [{ kind: "bits", label: "IEEE 754 单精度", groups: [{ label: "S | 阶码(8) | 尾数(23)", bits, splitAt: 9 }] }],
          metrics: [{ label: "符号", value: sign }, { label: "阶码", value: biased }, { label: "尾数", value: mantissa }],
        },
      ];
      return buildSimulation(base.meta, input, specs, issues);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 7. Cache 平均访问时间 AMAT ---------------- */
const amat: GenericModuleDef<any> = (() => {
  const base = M("co.amat", "co", "平均访问时间 AMAT",
    "命中率、命中时间、缺失代价三者如何决定平均访问时间。",
    "AMAT = 命中时间 + 缺失率 × 缺失代价",
    [
      { key: "hitRate", label: "命中率（%）", type: "select" as const, options: [90, 95, 98, 99].map((v) => ({ value: String(v), label: v + "%" })) },
      { key: "hitTime", label: "命中时间（周期）", type: "select" as const, options: [1, 2, 4].map((v) => ({ value: String(v), label: String(v) })) },
      { key: "missPenalty", label: "缺失代价（周期）", type: "select" as const, options: [20, 50, 100].map((v) => ({ value: String(v), label: String(v) })) },
    ]);
  interface Input { hitRate: string; hitTime: string; missPenalty: string }
  return {
    ...base,
    defaultInput: { hitRate: "95", hitTime: "1", missPenalty: "50" } as Input,
    simulate(input: Input) {
      const hit = Number(input.hitRate) / 100;
      const ht = Number(input.hitTime);
      const mp = Number(input.missPenalty);
      const miss = 1 - hit;
      const amatValue = ht + miss * mp;
      const specs: FrameSpec[] = [
        { type: "HIT", narration: `命中：耗时 ${ht} 周期，概率 ${(hit * 100).toFixed(0)}%`, views: [{ kind: "bars", label: "时间构成", max: mp, items: [{ label: "命中时间", value: ht, state: "done" }] }] },
        { type: "MISS", narration: `缺失：耗时 ${ht + mp} 周期，概率 ${(miss * 100).toFixed(0)}%`, views: [{ kind: "bars", label: "时间构成", max: mp, items: [{ label: "命中时间", value: ht, state: "done" }, { label: "缺失代价", value: mp, state: "bad" }] }] },
        { type: "AMAT", narration: `AMAT = ${ht} + ${miss.toFixed(2)} × ${mp} = ${amatValue.toFixed(2)} 周期`, views: [{ kind: "bars", label: "平均访问时间", max: ht + mp, items: [{ label: "AMAT", value: Number(amatValue.toFixed(2)), state: "active" }] }, { kind: "fields", items: [{ text: amatValue.toFixed(2), sub: "AMAT(周期)" }, { text: (miss * 100).toFixed(0) + "%", sub: "缺失率" }] }], metrics: [{ label: "AMAT", value: amatValue.toFixed(2) }, { label: "缺失率", value: (miss * 100).toFixed(0) + "%" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  } satisfies GenericModuleDef<any>;
})();

/* ---------------- 8. I/O 方式对比 ---------------- */
const ioModes: GenericModuleDef<any> = (() => {
  const base = M("co.io-modes", "co", "I/O 方式：查询 / 中断 / DMA",
    "同样的数据量，三种 I/O 控制方式下 CPU 参与程度完全不同。",
    "DMA 只在开始与结束打扰 CPU",
    [{ key: "kb", label: "传输数据量（KB）", type: "select" as const, options: [1, 4, 16].map((v) => ({ value: String(v), label: v + " KB" })) }]);
  interface Input { kb: string }
  return {
    ...base,
    defaultInput: { kb: "4" } as Input,
    simulate(input: Input) {
      const kb = Number(input.kb);
      const cycles = kb * 64; // 每个 KB 的 CPU 周期（教学抽象）
      const poll = cycles; const intr = Math.round(cycles * 0.4); const dma = 4;
      const specs: FrameSpec[] = [
        { type: "POLL", narration: `程序查询：CPU 全程等待，占用约 ${poll} 周期`, views: [{ kind: "timeline", label: "CPU 占用", span: poll, segments: [{ start: 0, end: poll, label: "查询等待", state: "bad" }] }], metrics: [{ label: "CPU 占用", value: poll }] },
        { type: "INTERRUPT", narration: `中断方式：每次传输一次中断，占用约 ${intr} 周期`, views: [{ kind: "timeline", label: "CPU 占用", span: poll, segments: [{ start: 0, end: intr, label: "中断处理", state: "warn" }, { start: intr, end: poll, label: "并行", state: "done" }] }], metrics: [{ label: "CPU 占用", value: intr }] },
        { type: "DMA", narration: `DMA：CPU 只在启动与结束时参与，约 ${dma} 周期`, views: [{ kind: "timeline", label: "CPU 占用", span: poll, segments: [{ start: 0, end: dma, label: "启动/结束", state: "done" }, { start: dma, end: poll, label: "DMA 传输（CPU 空闲）", state: "idle" }] }], metrics: [{ label: "CPU 占用", value: dma }, { label: "占比", value: ((dma / poll) * 100).toFixed(1) + "%" }] },
      ];
      return buildSimulation(base.meta, input, specs, []);
    },
  } satisfies GenericModuleDef<any>;
})();

export const batch2 = { instructionFormat, ieee754, amat, ioModes };