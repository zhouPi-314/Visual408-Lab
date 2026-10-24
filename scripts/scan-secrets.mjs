#!/usr/bin/env node
/**
 * 隐私与密钥扫描 —— 只扫 `git ls-files` 列出的已跟踪文件。
 *
 * 为什么不用目录遍历：pnpm 的 node_modules 在 Windows 上是目录联接（junction），
 * 遍历会走进 D:\pnpm-store 这类依赖缓存，产生大量误报（CI 上曾因此失败）。
 * 以 git 跟踪清单为准，既快又确定：只有真实会被提交的文件才需要扫描。
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** 二进制文件不参与文本规则匹配 */
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp4|wasm)$/i;

const RULES = [
  { name: "私钥块", re: /-----BEGIN (?:RSA|OPENSSH|EC|PGP|DSA) PRIVATE KEY-----/, level: "block" },
  { name: "疑似 API Key", re: /\b(?:sk|pk|ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/, level: "block" },
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/, level: "block" },
  { name: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, level: "block" },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/, level: "block" },
  { name: "本机绝对路径", re: /\b[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+/, level: "warn" },
  { name: "明文口令赋值", re: /\b(?:password|passwd|secret|token)\s*[:=]\s*["'][^"']{6,}["']/i, level: "warn" },
];

function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return out.split("\u0000").filter(Boolean);
  } catch {
    console.error("无法读取 git 文件清单，请确认在仓库内运行");
    process.exit(2);
  }
}

let blocking = 0;
let warnings = 0;
const files = trackedFiles().filter((p) => !BINARY_EXT.test(p) && p !== "scripts/scan-secrets.mjs");

for (const rel of files) {
  let text;
  try {
    text = await readFile(join(ROOT, rel), "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      if (!rule.re.test(lines[i])) continue;
      if (rule.level === "block") blocking += 1;
      else warnings += 1;
      const tag = rule.level === "block" ? "BLOCK" : "warn ";
      console.error(`${tag} [${rule.name}] ${rel}:${i + 1}  ${lines[i].trim().slice(0, 100)}`);
    }
  }
}

console.log(`扫描 ${files.length} 个已跟踪文本文件：阻断 ${blocking} 处，提醒 ${warnings} 处`);
process.exit(blocking === 0 ? 0 : 1);
