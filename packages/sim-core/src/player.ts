import type { Frame, Simulation } from "./protocol";

/**
 * 播放器：把不可变轨迹包成有状态的控制器。
 * 对应规划文档要求的 initialize / step / back / reset / serialize / validate 六个方法。
 */
export interface Player<S, E> {
  readonly index: number;
  readonly length: number;
  readonly frame: Frame<S, E>;
  initialize(): void;
  step(): void;
  back(): void;
  reset(): void;
  goto(index: number): void;
  serialize(): string;
}

export function createPlayer<I, S, E>(
  sim: Simulation<I, S, E>,
  onFrame?: (frame: Frame<S, E>, prev?: Frame<S, E>) => void,
): Player<S, E> {
  const frames = sim.frames;
  if (frames.length === 0) throw new Error(`模块 ${sim.meta.id} 没有产生任何帧`);

  let index = 0;
  const emit = () => onFrame?.(frames[index]!, index > 0 ? frames[index - 1] : undefined);

  return {
    get index() {
      return index;
    },
    get length() {
      return frames.length;
    },
    get frame() {
      return frames[index]!;
    },
    initialize() {
      index = 0;
      emit();
    },
    step() {
      if (index < frames.length - 1) {
        index += 1;
        emit();
      }
    },
    back() {
      if (index > 0) {
        index -= 1;
        emit();
      }
    },
    reset() {
      index = 0;
      emit();
    },
    goto(next: number) {
      index = Math.min(Math.max(Math.trunc(next), 0), frames.length - 1);
      emit();
    },
    serialize() {
      return JSON.stringify({ input: sim.input, index });
    },
  };
}
