import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "https://visual408-lab.pages.dev/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-con-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9337", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch("http://127.0.0.1:9337/json/version"); if (r.ok) { ws = (await r.json()).webSocketDebuggerUrl; break; } } catch {} }
const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 900 } });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
for (const path of ["#co/co.cache-direct-mapped", "#os/os.page-replacement", "#cross/cross.va-access-chain"]) {
  errors.length = 0;
  await p.goto(BASE + path, { waitUntil: "networkidle0" });
  await sleep(800);
  const bodyLen = await p.evaluate(() => document.body.innerText.length);
  console.log(path, "| text len:", bodyLen, "| errors:", errors.slice(0, 2).join(" || ") || "none");
}
await b.disconnect(); browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
