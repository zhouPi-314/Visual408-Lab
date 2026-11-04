#!/usr/bin/env node
/** 给新增实验补界面截图（与 docs/assets 已有实践一致）。 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4179/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-shot-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9340", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch("http://127.0.0.1:9340/json/version"); if (r.ok) { ws = (await r.json()).webSocketDebuggerUrl; break; } } catch {} }
if (!ws) { browser.kill(); console.error("Edge 启动失败"); process.exit(2); }
const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 900 } });
const p = await b.newPage();
const shots = [
  ["#ds/ds.prim-mst", "docs/assets/ui-prim.png", 5],
  ["#co/co.booth-mul", "docs/assets/ui-booth.png", 4],
  ["#os/os.dining", "docs/assets/ui-dining.png", 6],
  ["#net/net.cidr-sum", "docs/assets/ui-cidrsum.png", 2],
];
for (const [route, out, steps] of shots) {
  await p.goto(BASE + route, { waitUntil: "networkidle0" });
  await sleep(500);
  for (let i = 0; i < steps; i++) {
    const clicked = await p.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((x) => /下一步|播放/.test(x.textContent || ""));
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await sleep(250);
  }
  await sleep(250);
  await p.screenshot({ path: out });
  console.log("shot " + route + " -> " + out);
}
await b.disconnect();
browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
