import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbStorage, type AttemptRecord, type ProgressRecord } from "@visual408/storage";

const progress = (moduleId: string, frame: number, revision = 1): ProgressRecord => ({
  moduleId, frame, completed: false, updatedAt: new Date().toISOString(), revision,
});

const attempt = (id: string, moduleId: string, correct: boolean): AttemptRecord => ({
  id, moduleId, questionId: "q1", correct, at: new Date().toISOString(), answer: "12",
});

/**
 * 恢复演练（自动化）：模拟「导出备份 → 清空本地库（换设备/清缓存）→ 导入恢复」。
 * 这是 docs/backup-drill.md 里手工步骤的可执行版本。
 */
describe("恢复演练：导出 → 清空 → 导入", () => {
  it("进度与答题记录都能完整恢复", async () => {
    const store = await IndexedDbStorage.open();
    await store.clear();
    await store.putProgress(progress("co.cache-direct-mapped", 7, 3));
    await store.putProgress(progress("ds.sorting", 12, 2));
    await store.addAttempt(attempt("a1", "co.cache-direct-mapped", false));
    await store.addAttempt(attempt("a2", "ds.sorting", true));

    const backup = await store.exportAll();
    expect(backup.schemaVersion).toBe(1);
    expect(backup.progress).toHaveLength(2);
    expect(backup.attempts).toHaveLength(2);

    await store.clear();
    expect(await store.listProgress()).toHaveLength(0);

    await store.importAll(backup, "merge");
    expect((await store.listProgress()).find((r) => r.moduleId === "co.cache-direct-mapped")!.frame).toBe(7);
    expect(await store.listAttempts()).toHaveLength(2);
    store.close();
  });

  it("重复导入不会产生重复记录", async () => {
    const store = await IndexedDbStorage.open();
    await store.clear();
    await store.putProgress(progress("os.scheduling", 4));
    await store.addAttempt(attempt("b1", "os.scheduling", true));
    const backup = await store.exportAll();
    await store.importAll(backup, "merge");
    await store.importAll(backup, "merge");
    expect(await store.listProgress()).toHaveLength(1);
    expect(await store.listAttempts()).toHaveLength(1);
    store.close();
  });

  it("导入旧备份不会覆盖更新的进度（LWW）", async () => {
    const store = await IndexedDbStorage.open();
    await store.clear();
    await store.putProgress(progress("net.tcp-handshake", 9, 5));
    await store.importAll(
      { schemaVersion: 1, exportedAt: new Date().toISOString(), progress: [progress("net.tcp-handshake", 3, 1)], attempts: [] },
      "merge",
    );
    expect((await store.getProgress("net.tcp-handshake"))!.frame).toBe(9);
    store.close();
  });
});
