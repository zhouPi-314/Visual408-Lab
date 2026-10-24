# 无障碍与移动端审计

> 对比度为脚本实算（WCAG 2.1 相对亮度）；行为验证用 axe-core + 本机 Edge（headless CDP）。

## 1. 对比度

| 组合 | 前景 / 背景 | 对比度 | 结论 |
| --- | --- | --- | --- |
| 正文 / 背景 | #0f172a / #f4f5f7 | 16.1:1 | AA ✓ |
| 次级文字 / 卡片 | #475467 / #ffffff | 7.8:1 | AA ✓ |
| 三级文字 / 卡片 | #5d6675 / #ffffff | 5.4:1 | AA ✓ |
| 代码行号 / 代码底 | #475467 / #fafafb | 7.4:1 | AA ✓ |
| 主色 / 白 | #4338ca / #ffffff | 7.3:1 | AA ✓ |
| 白字 / 主色按钮 | #ffffff / #4338ca | 7.3:1 | AA ✓ |
| 强调 / 白 | #b45309 / #ffffff | 4.9:1 | AA ✓ |
| 命中 / 白 | #15803d / #ffffff | 4.8:1 | AA ✓ |
| 缺页 / 白 | #b42318 / #ffffff | 5.3:1 | AA ✓ |
| 深色正文 / 深色底 | #e6e8ee / #0b1020 | 15.0:1 | AA ✓ |
| 深色主色 / 深色底 | #818cf8 / #0b1020 | 7.9:1 | AA ✓ |

> 三级文字由 `#667085` 调到 `#5d6675`；代码行号由 `#98a2b3` 提到 `var(--ink-2)`——
> 这两处都是 axe 报出来的 serious 项，修完复测为 0。

## 2. 键盘与焦点

| 项 | 状态 |
| --- | --- |
| 全局 `focus-visible` 焦点环 | ✓ |
| 播放器快捷键 ← → 空格 R | ✓ |
| 搜索 `/` 打开、Esc 关闭、↑↓ Enter | ✓ |
| 弹层 focus trap（Tab 循环 / Esc / 焦点归还） | ✓ |
| skip-link、role=tablist、aria-selected、aria-current、aria-live | ✓ |

## 3. 动效

- `prefers-reduced-motion: reduce` 下关闭过渡与位移动画 ✓
- 无自动播放音视频，播放器默认暂停 ✓

## 4. 移动端 Dock

通栏固定条会遮挡内容，已改为悬浮胶囊：

```css
@media (max-width: 720px) {
  .transport { left: 10px; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); border-radius: 16px; }
  .app { padding-bottom: 168px; }
}
```

## 5. 深色模式

- 令牌级切换：`<html data-theme="dark">` 覆盖 CSS 变量，组件不用改；
- 首次访问跟随 `prefers-color-scheme`，手动切换后写入 localStorage；
- 顶栏「☀/☾」按钮带 `aria-pressed` 与中文 label；
- `?theme=dark` 可直接深链接到深色模式（用于分享与截图）。

## 6. 自动化证据（本地 + 线上，双主题）

```
[目录页]        违规 0 项
[实验页 Cache]  违规 0 项
[题库页]        违规 0 项
[焦点陷阱] / 打开后焦点在弹层内：是 · 连按 12 次 Tab 未逃出 · Esc 关闭：是
深色主题：违规 0 项
```

命令：`node scripts/a11y-audit.mjs <baseUrl>`（浅色 / `?theme=dark&` 深色各跑一次）。

## 7. 可访问性树（NVDA 读取的等价证据）

NVDA 在 Chromium 上经 UIA 读取，UIA 又来自浏览器的 AX tree。`scripts/ax-check.mjs` 输出实际暴露的 role/name：

```
[目录页]   可感知节点 17 · 标题: Visual408 Lab | 计算机组成原理 · 无名按钮: 0
[实验页]   可感知节点 33 · 标题: … | 地址拆分与 Cache 状态 | 统计 · 无名按钮: 0
[题库页]   可感知节点 43 · 标题: Visual408 Lab | 题库与解析 · 无名按钮: 0
[搜索弹层] role=dialog 名字: 知识搜索 · 内部输入框可感知
```

## 8. NVDA 实测结果（已完成）

用 `D:\Tools\NVDA\nvda.exe -l 10 --log-file=...` 启动 DEBUG 日志，用真实键盘 Tab/Enter 操作线上站点，
从日志中提取 NVDA 实际朗读的内容：

```text
'就绪'
'按钮', '搜索' / '按钮', '/'
'按钮', '题库'
'横幅区 路标', '回到当前学科目录', '按钮'
'在 GitHub 上给 Visual408 Lab 点 Star', '链接', '在 GitHub 上点 Star'
'切换到浅色模式', '切换按钮', '已按下'
'知识搜索', '对话框'
'搜索', '编辑框', '搜索知识点、题目或实验名…（Esc 关闭）'
```

结论：**角色（按钮/链接/对话框/编辑框）、名称、状态（已按下）都能被正确朗读**，
对话框有可读名字，输入框有可读标签与占位说明。

已知小问题：文件头附近有 3 次 `'数字 开'` 的异常朗读，来源未定位（不影响主要操作），列入待查。

## 8.1 安装位置与迁移

NVDA 的 NSIS 安装器**忽略 `/D` 参数**，所以"卸载 + 带 /D 重装"并不能改变安装位置
（实测：卸载后重装仍回到 `C:\Program Files\NVDA`，注册表也仍指向 C）。

因此改用**可移植副本**方案：

| 项 | 现状 |
| --- | --- |
| 官方安装 | `C:\Program Files\NVDA`（注册表登记的仍是它） |
| D 盘副本 | `D:\Tools\NVDA\nvda.exe`（有独立 `userconfig`，实质是可移植运行） |
| 上面的实测 | 用的是 **D 盘副本**，说明它完全可用 |

要彻底切到 D 盘（移除 C 盘安装 + 建快捷方式），以管理员身份运行：

```powershell
cd "D:\项目设计\计算机 408 可视化交互学习平台03"
powershell -ExecutionPolicy Bypass -File .\scripts\move-nvda-to-d.ps1
```

脚本先复制、再静默卸载 C、最后建「NVDA (D盘)」快捷方式。
**运行前必须先退出正在运行的 NVDA**（`Insert+Q`），否则脚本会提示并中止。

## 8.2 关于日志里出现的 `'数字 开'`

复查发现它并非本站元素：同一时段 NVDA 还朗读了
`'选择模型，当前 DeepSeek-V4.1-Flash-1017…'`、`'停止生成'` ——
这些属于当时的另一个前台窗口。也就是说 `'数字 开'` 是**别的程序**的控件被顺带播报，
与 Visual408 Lab 无关，已从待查项移除。

## 8.3 历史记录（保留）

| 项 | 状态 |
| --- | --- |
| NVDA 安装 | ✓ 已安装 2026.2（安装器忽略 `/D`，落在 `C:\Program Files\NVDA`；已复制一份到 `D:\Tools\NVDA`） |
| NVDA 启动 | ✓ 进程运行、日志显示 `NVDA initialized` |
| 朗读文本捕获 | ✗ **未完成**：安装器以提升权限启动，普通权限无法结束该实例，因此没法用 `-l 10` 以 DEBUG 级别重启来抓朗读日志 |

因此本文件**不声称完成 NVDA 人工走查**。当前的替代证据是：axe 双主题 0 违规 + 焦点陷阱自动验证 + AX tree role/name 完整。

### 待人工完成（需管理员权限重启 NVDA）

```powershell
# 以管理员身份运行
D:\Tools\NVDA\nvda.exe -l 10 --log-file=D:\Tools\NVDA\nvda-debug.log
```

然后按顺序走查：Tab 到学科切换 → Enter 进目录 → Tab 到实验卡片 → Enter → 空格播放 → `/` 打开搜索 → Esc。逐项确认朗读内容与视觉信息一致。