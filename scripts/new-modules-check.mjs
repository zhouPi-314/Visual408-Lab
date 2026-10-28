import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4176/";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(join(tmpdir(), "v408-new-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9338", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { const r = await fetch("http://127.0.0.1:9338/json/version"); if (r.ok) { ws = (await r.json()).webSocketDebuggerUrl; break; } } catch {} }
const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 1280, height: 1000 } });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));

const routes = [
  "#ds/ds.stack-queue", "#ds/ds.heap", "#ds/ds.hash-table", "#ds/ds.kruskal",
  "#co/co.instruction-format", "#co/co.ieee754", "#co/co.amat", "#co/co.io-modes",
  "#os/os.banker", "#os/os.semaphore", "#os/os.disk-scheduling", "#os/os.inode",
  "#net/net.crc", "#net/net.gbn-window", "#net/net.arp",
  "#ds/ds.dijkstra", "#ds/ds.topological", "#ds/ds.union-find", "#ds/ds.kmp-next",
  "#co/co.cache-write", "#co/co.instruction-cycle", "#co/co.bus-arbitration", "#co/co.raid",
  "#os/os.memory-partition", "#os/os.segment", "#os/os.file-allocate", "#os/os.interrupt",
  "#net/net.csma-cd", "#net/net.nat", "#net/net.dns-resolve",
  "#ds/ds.bst-search", "#ds/ds.floyd", "#ds/ds.huffman", "#ds/ds.cyclic-queue",
  "#co/co.pipeline-timing", "#co/co.cache-miss-types", "#co/co.data-representation", "#co/co.memory-interleave",
  "#os/os.page-fault", "#os/os.thrashing", "#os/os.disk-layout", "#os/os.peterson",
  "#net/net.cidr-route", "#net/net.tcp-flow-control", "#net/net.dhcp",
  "#ds/ds.b-tree", "#ds/ds.radix-sort", "#ds/ds.hash-chain", "#ds/ds.avl-rotation",
  "#co/co.pipeline-hazard", "#co/co.instruction-addressing", "#co/co.bus-timing", "#co/co.cpi",
  "#os/os.mlfq", "#os/os.deadlock-detect", "#os/os.segment-page", "#os/os.io-buffer",
  "#net/net.tcp-congestion", "#net/net.socket-api", "#net/net.ip-fragment",
];
let ok = 0;
for (const r of routes) {
  errors.length = 0;
  await p.goto(BASE + r, { waitUntil: "networkidle0" });
  await sleep(500);
  const views = await p.$$eval(".gv-block", (els) => els.length).catch(() => 0);
  const text = await p.evaluate(() => document.body.innerText.length);
  const pass = views > 0 && text > 200 && errors.length === 0;
  if (pass) ok++;
  console.log((pass ? "OK   " : "FAIL ") + r + " views=" + views + " text=" + text + (errors[0] ? " err=" + errors[0] : ""));
}
await b.disconnect(); browser.kill();
await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
console.log(ok + "/" + routes.length + " passed");
process.exit(ok === routes.length ? 0 : 1);