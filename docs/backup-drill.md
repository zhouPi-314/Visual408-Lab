# 备份与恢复演练

## 1. 数据在哪

学习进度与答题记录只存在浏览器 **IndexedDB**（库名 `visual408`，两张表：`progress` / `attempts`）。
没有服务端，因此**导出文件就是唯一备份**。

## 2. 手工演练（5 分钟）

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| 1 | 随便进两个实验，各按几步 | 顶部出现「已保存」 |
| 2 | 做一道题（对或错都行） | 「错题本」里能看到记录 |
| 3 | 点「导出备份」 | 下载 `visual408-backup-YYYY-MM-DD.json` |
| 4 | 浏览器开发者工具 → Application → IndexedDB → 删除 `visual408` | 刷新后进度归零（模拟清缓存/换设备） |
| 5 | 点「导入」选择刚才的文件 | 进度与答题记录恢复，页面提示「已合并导入」 |
| 6 | 再导入一次同一个文件 | 记录数**不应翻倍**（去重） |

## 3. 自动化证据

上述流程的可执行版本在 `tests/backup-drill.test.ts`，覆盖三个断言：

1. 导出 → 清空 → 导入后，进度帧号与答题记录完整恢复；
2. 重复导入不产生重复记录；
3. 导入**旧**备份不会覆盖**新**进度（按 revision/updatedAt 的 LWW 合并）。

运行：

```powershell
pnpm vitest run tests/backup-drill.test.ts
```

## 4. 备份文件格式

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-24T…",
  "progress": [{ "moduleId": "co.cache-direct-mapped", "frame": 7, "revision": 3, "updatedAt": "…", "completed": false }],
  "attempts": [{ "id": "…", "moduleId": "…", "questionId": "q1", "correct": false, "at": "…", "answer": "12" }]
}
```

`schemaVersion` 不匹配时导入会被拒绝并提示，不会写入脏数据。
