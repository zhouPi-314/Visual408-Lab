# 通用视图层（generic view layer）

15 个新实验没有各自的渲染器，它们共用一个视图层。

## 为什么

如果每个实验都手写 React 组件，新增实验的成本是「模拟器 + 测试 + UI + 内容」四份；
其中 UI 往往占一半时间，而且样式容易走形。

我们把「怎么显示」抽象成 7 种视图，模拟器只输出**数据 + 状态**：

| 视图 | 用途 | 用在哪些实验 |
| --- | --- | --- |
| `chips` | 一排带状态的方块 | 栈/队列、并查集、安全序列 |
| `bars` | 条形对比 | 堆、AMAT、inode 容量 |
| `grid` | 表格（可高亮行） | 哈希槽位 |
| `matrix` | 数字矩阵 | 银行家 Need 矩阵 |
| `bits` | 位串（可分块高亮） | 指令格式、IEEE 754、CRC |
| `timeline` | 时间轴分段 | 磁盘轨迹、GBN、I/O 占用 |
| `fields` | 字段卡片 | 信号量、寄存器、MAC |

## 契约

```ts
// packages/sim-core/src/view.ts
interface GenericModuleDef<I> {
  meta: SimMeta;
  summary: string;
  takeaway: string;
  fields: FieldDef[];        // 表单由它自动生成
  defaultInput: I;
  simulate: Simulator<I, GenericState, { type: string }>;
}
```

`simulate` 返回 `GenericState = { views: ViewData[]; metrics?: MetricItem[] }`，
Web 端 `makeGenericRenderer(mod)` 直接把它变成 `{ Inputs, Stage, Side }`。

## 代价

- 视图表达力有上限：树、图这类需要专门布局的结构仍要写专用渲染器（现有 13 个实验就是这样做的）；
- 所以本项目是「两种模式并存」：**强交互/复杂布局用专用渲染器，标准可视化用通用视图层**。

## 验证

`scripts/new-modules-check.mjs` 会逐个打开 15 个路由，断言页面里确实渲染出 `.gv-block`
且无运行时错误 —— 只检查「能不能打开」是不够的，必须确认视图真的画出来了。
