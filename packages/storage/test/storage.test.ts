import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbStorage, MemoryStorage, mergeProgress, type ProgressRecord } from "../src/index";

const rec = (moduleId: string, revision: number, frame = 0): ProgressRecord => ({
  moduleId,
  frame,
  completed: false,
  updatedAt: new Date(2026, 0, revision + 1).toISOString(),
  revision,
});

describe("mergeProgress：同步友好的合并策略", () => {
  it("按 revision 取较新者", () => {
    const merged = mergeProgress([rec("a", 2)], [rec("a", 1)]);
    expect(merged[0]!.revision).toBe(2);
  });
  it("revision 相同时按 updatedAt 取较新", () => {
    const older = { ...rec("a", 1), updatedAt: "2026-01-01T00:00:00.000Z" };
    const newer = { ...rec("a", 1), updatedAt: "2026-06-01T00:00:00.000Z" };
    expect(mergeProgress([older], [newer])[0]!.updatedAt).toBe(newer.updatedAt);
  });
  it("只存在于一侧的记录都会保留", () => {
    expect(mergeProgress([rec("a", 1)], [rec("b", 1)]).map((r) => r.moduleId)).toEqual(["a", "b"]);
  });
});

describe("MemoryStorage：端口契约", () => {
  it("读写进度与答题记录", async () => {
    const s = new MemoryStorage();
    expect(await s.getProgress("co.x")).toBeNull();
    await s.putProgress(rec("co.x", 1, 5));
    expect((await s.getProgress("co.x"))!.frame).toBe(5);
    await s.addAttempt({ id: "1", moduleId: "co.x", questionId: "q1", correct: true, at: "2026-10-24T00:00:00Z" });
    expect(await s.listAttempts("co.x")).toHaveLength(1);
    expect(await s.listAttempts("nope")).toHaveLength(0);
  });

  it("合并导入不会用旧数据覆盖新数据", async () => {
    const s = new MemoryStorage();
    await s.putProgress(rec("a", 5, 50));
    await s.importAll({ schemaVersion: 1, exportedAt: new Date().toISOString(), progress: [rec("a", 2, 2)], attempts: [] }, "merge");
    expect((await s.getProgress("a"))!.revision).toBe(5);
  });

  it("导出 / 导入 / 清空", async () => {
    const s = new MemoryStorage();
    await s.putProgress(rec("a", 1));
    const backup = await s.exportAll();
    expect(backup.schemaVersion).toBe(1);
    await s.clear();
    expect(await s.listProgress()).toHaveLength(0);
    await s.importAll(backup, "replace");
    expect(await s.listProgress()).toHaveLength(1);
  });
});

describe("IndexedDbStorage：真实适配器（fake-indexeddb）", () => {
  it("持久化进度、按模块过滤答题记录、合并导入", async () => {
    const s = await IndexedDbStorage.open();
    await s.clear();

    await s.putProgress(rec("co.cache", 1, 7));
    expect((await s.getProgress("co.cache"))!.frame).toBe(7);

    await s.addAttempt({ id: "a1", moduleId: "co.cache", questionId: "q1", correct: false, at: "2026-10-24T00:00:00Z" });
    await s.addAttempt({ id: "a2", moduleId: "os.page", questionId: "q1", correct: true, at: "2026-10-24T01:00:00Z" });
    expect(await s.listAttempts("co.cache")).toHaveLength(1);
    expect(await s.listAttempts()).toHaveLength(2);

    const backup = await s.exportAll();
    await s.clear();
    await s.importAll(backup, "merge");
    expect((await s.getProgress("co.cache"))!.frame).toBe(7);
    expect(await s.listAttempts()).toHaveLength(2);

    // 重复导入不会产生重复答题记录
    await s.importAll(backup, "merge");
    expect(await s.listAttempts()).toHaveLength(2);
    s.close();
  });
});
