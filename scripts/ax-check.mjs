#!/usr/bin/env node
/**
 * 可访问性树（AX tree）检查：输出屏幕阅读器实际拿到的 role/name。
 * NVDA 在 Chromium 上通过 UIA 读取，UIA 又来自 AX tree —— 这是可复现的等价证据。
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-ax-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9335", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const res = await fetch("http://127.0.0.1:9335/json/version"); if (res.ok) { ws = (await res.json()).webSocketDebuggerUrl; break; } } catch { /* retry */ }
}
if (!ws) { browser.kill(); console.error("Edge 启动失败"); process.exit(2); }

const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 900 } });
const p = await b.newPage();

const flat = (node, out = [], depth = 0) => {
  if (!node) return out;
  if (["button", "link", "heading", "tab", "dialog", "searchbox", "textbox", "combobox", "list", "listitem"].includes(node.role)) {
    out.push({ role: node.role, name: (node.name ?? "").slice(0, 50), depth });
  }
  for (const c of node.children ?? []) flat(c, out, depth + 1);
  return out;
};

for (const [label, path] of [["目录页", "#co"], ["实验页", "#co/co.cache-direct-mapped"], ["题库页", "#bank"]]) {
  await p.goto(BASE + path, { waitUntil: "networkidle0" });
  const snap = await p.accessibility.snapshot({ interestingOnly: true });
  const nodes = flat(snap);
  const headings = nodes.filter((n) => n.role === "heading").slice(0, 3).map((n) => n.name);
  const unnamedButtons = nodes.filter((n) => n.role === "button" && !n.name).length;
  console.log(`[${label}] 可感知节点 ${nodes.length} · 标题: ${headings.join(" | ") || "（无）"} · 无名按钮: ${unnamedButtons}`);
}

// 搜索弹层：role=dialog 是否有名字、内部控件是否可感知
await p.goto(BASE + "#co", { waitUntil: "networkidle0" });
await p.keyboard.press("/");
await sleep(400);
const dlg = await p.accessibility.snapshot({ interestingOnly: true });
const dialogNode = (function find(node) {
  if (!node) return null;
  if (node.role === "dialog") return node;
  for (const c of node.children ?? []) { const r = find(c); if (r) return r; }
  return null;
})(dlg);
console.log(`[搜索弹层] role=dialog 名字: ${dialogNode?.name ?? "（缺失）"}`);
const inner = dialogNode ? flat(dialogNode).filter((n) => n.role === "textbox" || n.role === "listitem") : [];
console.log(`[搜索弹层] 内部输入框/结果项: ${inner.length} 个 · 前 3: ${inner.slice(0, 3).map((n) => n.role).join(",")}`);

await b.disconnect();
browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
process.exit(dialogNode?.name ? 0 : 1);
