#!/usr/bin/env node
/**
 * 提交前/CI 的隐私与密钥扫描。
 * 只针对「明显的密钥形态」与「本机绝对路径」，不追求覆盖全部敏感信息。
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-types", "coverage", ".vite"]);
const SKIP_FILES = new Set(["scan-secrets.mjs", "pnpm-lock.yaml"]);

const RULES = [
  { name: "私钥块", re: /-----BEGIN (?:RSA|OPENSSH|EC|PGP|DSA) PRIVATE KEY-----/ },
  { name: "疑似 API Key", re: /\b(?:sk|pk|ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/ },
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/ },
  { name: "本机绝对路径", re: /\b[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+/ },
  { name: "明文口令赋值", re: /\b(?:password|passwd|secret|token)\s*[:=]\s*["'][^"']{6,}["']/i },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (!SKIP_FILES.has(entry.name)) yield full;
  }
}

let hits = 0;
let scanned = 0;
for await (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue;
  scanned++;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      if (rule.name === "本机绝对路径" && rel.startsWith("docs/")) continue;
      if (rule.re.test(lines[i])) {
        hits++;
        console.error("x [" + rule.name + "] " + rel + ":" + (i + 1));
        console.error("    " + lines[i].trim().slice(0, 120));
      }
    }
  }
}

console.log("扫描 " + scanned + " 个文件，命中 " + hits + " 处");
process.exit(hits === 0 ? 0 : 1);
