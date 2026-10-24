import { describe, expect, it } from "vitest";
import { module as exec } from "../src/modules/program-execution";

const run = (patch: Partial<typeof exec.defaultInput> = {}) =>
  exec.simulate({ ...exec.defaultInput, ...patch });

const last = (patch: Partial<typeof exec.defaultInput> = {}) => run(patch).frames.at(-1)!.state;

describe("cross.program-execution-chain：编译与布局", () => {
  it("一行 C++ 被拆成 6 条指令", () => {
    expect(last().instructions).toHaveLength(6);
  });

  it("指令覆盖读下标、算地址、读元素、加一、写回", () => {
    const text = last().instructions.map((i) => i.text).join("\n");
    expect(text).toContain("lw");
    expect(text).toContain("slli");
    expect(text).toContain("addi");
    expect(text).toContain("sw");
  });

  it("内存布局里 a[i] 的偏移随下标变化", () => {
    const s = last({ arrayIndex: 5 });
    expect(s.memory.find((m) => m.name === "a[5]")!.offset).toBe("sp+8+20");
  });
});

describe("cross.program-execution-chain：流水线", () => {
  it("6 条指令、2 处 load-use 停顿、共 12 拍", () => {
    const s = last();
    expect(s.stalls).toBe(2);
    expect(s.totalCycles).toBe(12);
  });

  it("CPI = 总周期 / 指令数 = 2.00", () => {
    expect(last().cpi).toBeCloseTo(12 / 6, 5);
  });

  it("每条指令都占据 IF→WB 五段", () => {
    const s = last();
    const stages = s.pipe[0]!.filter((c) => c.stage).map((c) => c.stage);
    expect(stages).toEqual(["IF", "ID", "EX", "MEM", "WB"]);
  });

  it("第十二拍之后没有指令还在流水线里", () => {
    const s = last();
    const occupied = s.pipe.flat().filter((c) => c.stage !== "");
    expect(occupied).toHaveLength(6 * 5);
  });
});

describe("cross.program-execution-chain：进程视角", () => {
  it("时间片 ≥ 12 拍时不需要切换", () => {
    const s = last({ quantum: 12 });
    expect(s.slices).toBe(1);
    expect(s.switches).toBe(0);
  });

  it("时间片 5 拍时切成 3 片、切换 2 次", () => {
    const s = last({ quantum: 5 });
    expect(s.slices).toBe(3);
    expect(s.switches).toBe(2);
  });
});

describe("cross.program-execution-chain：输入校验", () => {
  it("下标越界报错", () => {
    expect(exec.simulate({ ...exec.defaultInput, arrayIndex: 99 }).validate().some((i) => i.path === "arrayIndex")).toBe(true);
  });

  it("时间片越界报错", () => {
    expect(exec.simulate({ ...exec.defaultInput, quantum: 0 }).validate().some((i) => i.path === "quantum")).toBe(true);
  });
});
