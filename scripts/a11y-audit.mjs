#!/usr/bin/env node
/**
 * 无障碍自动化审计：axe-core + 本机 Edge（headless，CDP）。
 * 同时验证弹层焦点陷阱：Tab 不得逃出弹层、Esc 可关闭、关闭后焦点归还。
 *
 * 用法：node scripts/a11y-audit.mjs [baseUrl]
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PAGES = [
  { name: "目录页", path: "#co" },
  { name: "实验页（Cache）", path: "#co/co.cache-direct-mapped" },
  { name: "题库页", path: "#bank" },
];

const profile = await mkdtemp(join(tmpdir(), "v408-a11y-"));
const browser = spawn(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--remote-debugging-port=9333",
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let endpoint = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try {
    const res = await fetch("http://127.0.0.1:9333/json/version");
    if (res.ok) {
      endpoint = (await res.json()).webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* retry */
  }
}
if (!endpoint) {
  browser.kill();
  console.error("无法启动 Edge 调试端口");
  process.exit(2);
}

const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const b = await puppeteer.connect({ browserWSEndpoint: endpoint, defaultViewport: { width: 1280, height: 900 } });

let total = 0;
const serious = [];
for (const page of PAGES) {
  const p = await b.newPage();
  await p.goto(BASE + page.path, { waitUntil: "networkidle0", timeout: 30000 });
  await p.evaluate(axeSource);
  const result = await p.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  });
  const violations = result.violations;
  total += violations.length;
  console.log(`\n[${page.name}] 违规 ${violations.length} 项`);
  for (const v of violations) {
    console.log(`  - (${v.impact}) ${v.id}: ${v.help} · 命中 ${v.nodes.length} 处`);
    if (v.impact === "serious" || v.impact === "critical") {
      serious.push(`${page.name}:${v.id}`);
      console.log(`    例：${String(v.nodes[0]?.html ?? "").slice(0, 120)}`);
    }
  }
  await p.close();
}

// --- 焦点陷阱验证 ---
const p = await b.newPage();
await p.goto(BASE + "#co", { waitUntil: "networkidle0" });
await p.keyboard.press("/");
await sleep(300);
const inside = async () =>
  p.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
const startsInside = await inside();
let escaped = false;
for (let i = 0; i < 12; i++) {
  await p.keyboard.press("Tab");
  if (!(await inside())) escaped = true;
}
await p.keyboard.press("Escape");
await sleep(200);
const closed = await p.evaluate(() => !document.querySelector('[role="dialog"]'));

console.log("\n[焦点陷阱]");
console.log(`  / 打开后焦点在弹层内：${startsInside ? "是" : "否"}`);
console.log(`  连按 12 次 Tab 是否逃出：${escaped ? "是（不合格）" : "否（通过）"}`);
console.log(`  Esc 关闭：${closed ? "是" : "否"}`);
await p.close();

await b.disconnect();
browser.kill();
// Edge 退出后文件可能仍被占用，清理失败不应影响审计结论
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});

const ok = total === 0 && startsInside && !escaped && closed;
console.log(`\n合计 axe 违规 ${total} 项，严重级 ${serious.length} 项`);
process.exit(ok ? 0 : 1);