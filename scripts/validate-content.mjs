#!/usr/bin/env node
/**
 * 内容校验 CLI：schema + 版权门禁。
 * 用法：node scripts/validate-content.mjs
 * 退出码：0 通过；1 有 error（CI 以此为准）
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { parseModuleMeta } from "../packages/content-schema/src/index.ts";

const ROOT = fileURLToPath(new URL("../content/", import.meta.url));

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name === "module.yaml") yield full;
  }
}

let failed = 0;
let checked = 0;
for await (const file of walk(ROOT)) {
  checked += 1;
  const raw = await readFile(file, "utf8");
  const data = parseYaml(raw);
  const result = parseModuleMeta(data);
  if (!result.ok) {
    failed += 1;
    console.error(`✗ ${file}`);
    for (const err of result.errors) console.error(`   - ${err}`);
  } else {
    console.log(`✓ ${result.value.id}`);
  }
}

console.log(`\n共检查 ${checked} 个模块，失败 ${failed} 个`);
process.exit(failed === 0 ? 0 : 1);