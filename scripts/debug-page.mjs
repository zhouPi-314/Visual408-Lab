import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://127.0.0.1:4176/#ds/ds.heap";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-dbg-"));
const br = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch("http://127.0.0.1:9339/json/version"); if (r.ok) { ws = (await r.json()).webSocketDebuggerUrl; break; } } catch {} }
const b = await puppeteer.connect({ browserWSEndpoint: ws });
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
await p.goto(url, { waitUntil: "networkidle0" });
await sleep(800);
const text = await p.evaluate(() => document.body.innerText);
console.log("TEXT:", text.slice(0, 600).replace(/\n/g, " | "));
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
await b.disconnect(); br.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
