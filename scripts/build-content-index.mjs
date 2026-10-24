#!/usr/bin/env node
/**
 * 从 content/ 生成前端可用的知识索引（搜索 + 练习用）。
 * 内容仍是唯一事实源；这里只做提取，不新增语义。
 * 输出：apps/web/src/generated/content-index.json
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CONTENT = join(ROOT, "content");
const OUT = join(ROOT, "apps/web/src/generated/content-index.json");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name === "module.yaml") yield full;
  }
}

const stripMd = (md) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_|\-]{1,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const modules = [];
for await (const file of walk(CONTENT)) {
  const dir = dirname(file);
  const meta = parseYaml(await readFile(file, "utf8"));
  let theory = "";
  try {
    theory = stripMd(await readFile(join(dir, meta.theory ?? "theory.mdx"), "utf8"));
  } catch {
    theory = "";
  }
  modules.push({
    id: meta.id,
    subject: meta.subject,
    title: meta.title,
    objectives: meta.objectives ?? [],
    labTasks: meta.labTasks ?? [],
    questions: (meta.questions ?? []).map((q) => ({
      id: q.id,
      kind: q.kind,
      stem: q.stem,
      answer: q.answer,
      explanation: q.explanation,
      source: q.source?.kind ?? "original",
    })),
    theoryExcerpt: theory.slice(0, 320),
  });
}

modules.sort((a, b) => a.id.localeCompare(b.id));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), modules }, null, 2) + "\n", "utf8");
console.log(`content-index: ${modules.length} modules → apps/web/src/generated/content-index.json`);
