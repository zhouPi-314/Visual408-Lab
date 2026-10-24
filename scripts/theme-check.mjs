#!/usr/bin/env node
/**
 * 主题冒烟测试：确认浅色/深色令牌真的生效（读计算样式，不看截图猜颜色）。
 * 用法：node scripts/theme-check.mjs [baseUrl]
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-theme-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try {
    const res = await fetch("http://127.0.0.1:9334/json/version");
    if (res.ok) { ws = (await res.json()).webSocketDebuggerUrl; break; }
  } catch { /* retry */ }
}
if (!ws) { browser.kill(); console.error("Edge 启动失败"); process.exit(2); }

const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 900 } });
const probe = async (theme) => {
  const p = await b.newPage();
  await p.goto(`${BASE}?theme=${theme}#co/co.cache-direct-mapped`, { waitUntil: "networkidle0" });
  const out = await p.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.theme,
      bg: cs.backgroundColor,
      ink: cs.color,
      primary: root.getPropertyValue("--primary").trim(),
    };
  });
  await p.close();
  return out;
};

const light = await probe("light");
const dark = await probe("dark");
console.log("light:", JSON.stringify(light));
console.log("dark :", JSON.stringify(dark));

const ok =
  light.theme === "light" && dark.theme === "dark" &&
  light.bg !== dark.bg && light.ink !== dark.ink && light.primary !== dark.primary;

await b.disconnect();
browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
console.log(ok ? "主题切换：通过" : "主题切换：失败");
process.exit(ok ? 0 : 1);
