import type { ModuleDefinition } from "./protocol";

/**
 * 显式注册表（不做文件系统魔法扫描）：
 * - 新增模块 = 在 modules/<id>/index.ts 导出 module，再在此加一行；
 * - 用动态 import 保证按需加载，首屏不背所有模块；
 * - UI 只依赖 loadModule()，不 import 具体模块 → 低耦合。
 */

/* 注册表内部必须容纳异构模块，此处用 any 是唯一的逃生口；
   对外 API 保持泛型，调用方仍拿到精确类型。 */
type AnyModule = ModuleDefinition<any, any, any>;

export type ModuleId = string;

const loaders: Record<ModuleId, () => Promise<{ module: AnyModule }>> = {
  "co.cache-direct-mapped": () => import("./modules/cache-direct-mapped"),
  "co.cache-associative": () => import("./modules/cache-associative"),
  "os.page-replacement": () => import("./modules/page-replacement"),
  "os.scheduling": () => import("./modules/scheduling"),
  "ds.binary-tree-traversal": () => import("./modules/binary-tree-traversal"),
  "ds.sorting": () => import("./modules/sorting"),
  "ds.graph-traversal": () => import("./modules/graph-traversal"),
  "ds.search": () => import("./modules/search"),
  "net.tcp-handshake": () => import("./modules/tcp-handshake"),
  "net.subnetting": () => import("./modules/subnetting"),
  "cross.va-access-chain": () => import("./modules/va-access-chain"),
  "cross.network-send-chain": () => import("./modules/network-send"),
  "cross.program-execution-chain": () => import("./modules/program-execution"),
  "ds.stack-queue": () => import("./modules/generic/batch1").then((m) => ({ module: m.batch1.stackQueue as AnyModule })),
  "ds.heap": () => import("./modules/generic/batch1").then((m) => ({ module: m.batch1.heap as AnyModule })),
  "ds.hash-table": () => import("./modules/generic/batch1").then((m) => ({ module: m.batch1.hashTable as AnyModule })),
  "ds.kruskal": () => import("./modules/generic/batch1").then((m) => ({ module: m.batch1.kruskal as AnyModule })),
  "co.instruction-format": () => import("./modules/generic/batch2").then((m) => ({ module: m.batch2.instructionFormat as AnyModule })),
  "co.ieee754": () => import("./modules/generic/batch2").then((m) => ({ module: m.batch2.ieee754 as AnyModule })),
  "co.amat": () => import("./modules/generic/batch2").then((m) => ({ module: m.batch2.amat as AnyModule })),
  "co.io-modes": () => import("./modules/generic/batch2").then((m) => ({ module: m.batch2.ioModes as AnyModule })),
  "os.banker": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.banker as AnyModule })),
  "os.semaphore": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.semaphore as AnyModule })),
  "os.disk-scheduling": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.diskScheduling as AnyModule })),
  "os.inode": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.inode as AnyModule })),
  "net.crc": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.crc as AnyModule })),
  "net.gbn-window": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.gbn as AnyModule })),
  "net.arp": () => import("./modules/generic/batch3").then((m) => ({ module: m.batch3.arp as AnyModule })),
};

export function listModuleIds(): ModuleId[] {
  return Object.keys(loaders);
}

export async function loadModule<I, S, E>(id: ModuleId): Promise<ModuleDefinition<I, S, E>> {
  const loader = loaders[id];
  if (!loader) throw new Error(`未注册的模块：${id}`);
  const mod = await loader();
  return mod.module as ModuleDefinition<I, S, E>;
}