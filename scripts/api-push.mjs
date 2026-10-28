#!/usr/bin/env node
/**
 * 网络受限时用 GitHub REST API 推送提交（git https 被重置时的备用通道）。
 * 用法：node scripts/api-push.mjs <base-commit> <commit-message>
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const [base, message] = process.argv.slice(2);
if (!base || !message) {
  console.error("用法: node scripts/api-push.mjs <base-commit> <message>");
  process.exit(2);
}

const cred = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
}).stdout;
const token = /password=(.+)/.exec(cred)?.[1]?.trim();
if (!token) {
  console.error("无法读取 GitHub 凭据");
  process.exit(2);
}

const API = "https://api.github.com/repos/zhouPi-314/Visual408-Lab";
const headers = {
  Authorization: "token " + token,
  "User-Agent": "visual408-api-push",
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
};
const cwd = process.cwd();

const changed = spawnSync("git", ["diff", "--name-only", base, "HEAD"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
console.log("changed files:", changed.length);

const head = await (await fetch(API + "/commits/main", { headers })).json();
const blobFor = async (path) => {
  const content = (await readFile(join(cwd, path))).toString("base64");
  const res = await fetch(API + "/git/blobs", {
    method: "POST",
    headers,
    body: JSON.stringify({ content, encoding: "base64" }),
  });
  if (!res.ok) throw new Error("blob " + path + ": " + res.status + " " + (await res.text()).slice(0, 120));
  return { path: path.replace(/\\/g, "/"), mode: "100644", type: "blob", sha: (await res.json()).sha };
};

const entries = [];
const queue = [...changed];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    if (!p) break;
    entries.push(await blobFor(p));
  }
});
await Promise.all(workers);
console.log("blobs uploaded:", entries.length);

const treeRes = await fetch(API + "/git/trees", {
  method: "POST",
  headers,
  body: JSON.stringify({ base_tree: head.commit.tree.sha, tree: entries }),
});
const tree = await treeRes.json();
if (!treeRes.ok || !tree.sha) throw new Error("tree: " + treeRes.status + " " + JSON.stringify(tree).slice(0, 300));

const commitRes = await fetch(API + "/git/commits", {
  method: "POST",
  headers,
  body: JSON.stringify({ message, tree: tree.sha, parents: [head.sha] }),
});
const commit = await commitRes.json();
if (!commitRes.ok || !commit.sha) throw new Error("commit: " + commitRes.status + " " + JSON.stringify(commit).slice(0, 300));

const patch = await fetch(API + "/git/refs/heads/main", {
  method: "PATCH",
  headers,
  body: JSON.stringify({ sha: commit.sha, force: false }),
});
if (!patch.ok) throw new Error("update ref: " + patch.status + " " + (await patch.text()).slice(0, 160));
console.log("remote head:", commit.sha.slice(0, 8));