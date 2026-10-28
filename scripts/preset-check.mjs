import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4178/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-ps-"));
const br = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9342", "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch("http://127.0.0.1:9342/json/version"); if (r.ok) { ws = (await r.json()).webSocketDebuggerUrl; break; } } catch {} }
const b = await puppeteer.connect({ browserWSEndpoint: ws });
const p = await b.newPage();
await p.goto(BASE + "#ds/ds.bst-search", { waitUntil: "networkidle0" });
await sleep(600);

const chips = await p.$$eval(".preset-chip", (els) => els.map((e) => e.textContent));
console.log("chips:", chips.join(" / "));

const read = async () => ({
  target: await p.$eval(".input-bar select", (e) => (e).value),
  narration: await p.$eval(".callout p", (e) => e.textContent.trim().slice(0, 30)),
});
const before = await read();
await p.click(".preset-chip:nth-of-type(2)");
await sleep(500);
const after = await read();
console.log("before:", JSON.stringify(before));
console.log("after :", JSON.stringify(after));
console.log("preset applied:", before.target !== after.target);

await b.disconnect(); br.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
