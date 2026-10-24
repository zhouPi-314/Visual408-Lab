import { z } from "zod";

/**
 * 内容元数据 schema —— 版权门禁写在这里，而不是散落在各模块里。
 * 规则：非原创内容必须显式声明 authorized: true，否则校验失败（对应风险 R-01）。
 */

export const SourceRefSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url().optional(),
  })
  .strict();

export const QuestionSourceSchema = z
  .object({
    kind: z.enum(["original", "authorized-exam", "user-import"]),
    year: z.number().int().min(2009).max(2100).optional(),
    /** 必须显式声明许可，即使是 original */
    license: z.string().min(1),
    authorized: z.boolean(),
  })
  .strict()
  .superRefine((src, ctx) => {
    if (src.kind !== "original" && !src.authorized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "非原创内容必须 authorized: true 并附授权说明，禁止把未授权真题/教材内容入库",
        path: ["authorized"],
      });
    }
    if (src.kind === "authorized-exam" && src.year === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "授权真题必须标注年份", path: ["year"] });
    }
  });

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["choice", "fill", "hand-calculation", "ordering", "operation"]),
    stem: z.string().min(1),
    source: QuestionSourceSchema,
    answer: z.string().min(1),
    explanation: z.string().min(1),
  })
  .strict();

export const ModuleMetaSchema = z
  .object({
    id: z.string().regex(/^(ds|co|os|net|cross)\.[a-z0-9-]+$/, "id 形如 co.cache-direct-mapped"),
    subject: z.enum(["ds", "co", "os", "net", "cross"]),
    title: z.string().min(1),
    syllabusVersion: z.string().min(1),
    prerequisites: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    objectives: z.array(z.string().min(1)).min(1),
    theory: z.string().min(1),
    displayer: z.enum(["single-step", "interactive", "timeline"]),
    inputModes: z.array(z.enum(["preset", "custom", "random", "boundary"])).min(1),
    simulator: z.string().min(1),
    codeExamples: z.array(
      z.object({ lang: z.literal("cpp"), file: z.string().min(1), verified: z.boolean() }).strict(),
    ),
    labTasks: z.array(z.string()).default([]),
    questions: z.array(QuestionSchema).default([]),
    tests: z.string().min(1),
    sources: z.array(SourceRefSchema).default([]),
  })
  .strict();

export type ModuleMeta = z.infer<typeof ModuleMetaSchema>;
export type Question = z.infer<typeof QuestionSchema>;

export function parseModuleMeta(input: unknown): { ok: true; value: ModuleMeta } | { ok: false; errors: string[] } {
  const parsed = ModuleMetaSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`),
  };
}
