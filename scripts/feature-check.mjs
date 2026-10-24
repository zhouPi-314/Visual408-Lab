#!/usr/bin/env node
/** 线上功能冒烟：用 DOM 断言新特性真的发布了（不靠搜 bundle 字符串）。 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "https://visual408-lab.pages.dev/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-feat-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9336", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const res = await fetch("http://127.0.0.1:9336/json/version"); if (res.ok) { ws = (await res.json()).webSocketDebuggerUrl; break; } } catch {}
}
if (!ws) { browser.kill(); console.error("Edge 启动失败"); process.exit(2); }
const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 900 } });
const p = await b.newPage();

const check = async (path, sel, label) => {
  await p.goto(BASE + path, { waitUntil: "networkidle0" });
  const ok = await p.$(sel) !== null;
  console.log(`${ok ? "OK  " : "MISS"} ${label}`);
  return ok;
};

const results = [];
results.push(await check("#co", 'select[aria-label="学习档案"]', "学习档案切换器"));
results.push(await check("#co/co.cache-direct-mapped", 'input[aria-label="实验内搜索"]', "实验内搜索"));
results.push(await check("#co/co.cache-direct-mapped", ".related", "相关实验"));
results.push(await check("#os/os.page-replacement", "button[aria-pressed]", "只看当前列开关"));
results.push(await check("#cross/cross.va-access-chain", 'input[type="text"]', "可编辑页表输入"));

await b.disconnect();
browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
process.exit(results.every(Boolean) ? 0 : 1);
