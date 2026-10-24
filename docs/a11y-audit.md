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

## 8. NVDA 实测状态（重要：未完成）

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
