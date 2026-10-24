# 贡献指南

感谢你愿意改进 Visual408 Lab。三条原则优先于一切：**教学正确、可验证、可维护**。

## 报问题

- 知识性错误：写明**实验名 + 第几步 + 期望值**，最好附教材/教材版本依据；
- 界面问题：附截图、浏览器与屏幕宽度（移动端请注明机型）；
- 无障碍问题：说明是键盘、对比度还是读屏器问题，读屏器请注明名称与版本。

## 提交代码

1. 新建分支：`feat/<实验 id>` 或 `fix/<简述>`；
2. 新增实验需要**同时**包含：
   - `packages/sim-core/src/modules/<id>/`：`types.ts` / `sim.ts` / `index.ts`
   - 黄金测试 `packages/sim-core/test/<id>.test.ts`
   - 渲染器 `apps/web/src/modules/<id>/`
   - 内容 `content/<subject>/<id>/`（module.yaml、theory.mdx、tests.json）
   - 在 `registry.ts` 与 `catalog.ts` 各注册一行
3. 本地先跑通：

```powershell
pnpm typecheck
pnpm test
pnpm content:check
pnpm build
```

4. PR 描述请写清：**这个实验教什么、测试向量怎么来的、与哪个已有实验相关**。

## 内容规范

- 不提交未授权的考研真题、教材图表或第三方题库；
- 题目必须是原创或已获授权，`module.yaml` 里 `source.authorized` 必须为 `true`；
- 中文为主、术语保留英文原文（如 Cache、TLB、CPI）。

## 代码风格

- 模拟器**禁止**使用随机数、`Date.now()`、DOM API；
- 每帧必须能独立渲染（不可变快照），不要依赖上一帧；
- 提交前请确保 `pnpm test` 全绿。
