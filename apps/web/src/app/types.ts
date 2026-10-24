import type { Frame, Issue, SimMeta, Simulator } from "@visual408/sim-core";
import type { FC } from "react";

/**
 * 渲染器契约：模拟逻辑在 sim-core，渲染在 Web 层。
 * Shell 只认这个接口，不认识任何具体模块 —— 加模块不改 Shell。
 */
export interface ModuleRenderer<I, S, E> {
  meta: SimMeta;
  defaultInput: I;
  simulate: Simulator<I, S, E>;
  /** 参数输入区 */
  Inputs: FC<{ input: I; onChange: (next: I) => void; issues: readonly Issue[] }>;
  /** 主视图 */
  Stage: FC<{ frame: Frame<S, E> | undefined }>;
  /** 侧栏：统计、代码联动等 */
  Side: FC<{ frame: Frame<S, E> | undefined }>;
}

/* Shell 内部要容纳异构渲染器，这里是唯一的边界；
   每个模块组件内部仍然使用精确类型。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRenderer = ModuleRenderer<any, any, any>;
