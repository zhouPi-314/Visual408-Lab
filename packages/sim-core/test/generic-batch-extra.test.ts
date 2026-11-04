import { describe, expect, it } from "vitest";
import { batch10, batch11 } from "../src/index";

const lastM = (sim: any) => {
  const last = sim.frames[sim.frames.length - 1]!;
  const m: Record<string, any> = {};
  for (const x of (last.state as any).metrics ?? []) m[x.label] = x.value;
  return m;
};

describe("batch10/11 边界补充", () => {
  it("net.ipv6-address：fe80 前缀压缩正确", () => {
    const m = lastM(batch11.ipv6.simulate({ addr: "fe80:0000:0000:0000:0202:b3ff:fe1e:8329", prefix: "64" }));
    expect(m["压缩写法"]).toBe("fe80::202:b3ff:fe1e:8329/64");
  });
  it("net.selective-repeat：不丢帧时 SR/GBN 都是 0", () => {
    const m = lastM(batch11.selectiveRepeat.simulate({ frames: "6", window: "3", lost: "0" }));
    expect(m["SR重传"]).toBe(0);
    expect(m["GBN重传"]).toBe(0);
  });
  it("net.stop-wait：丢确认帧也重传一次", () => {
    const m = lastM(batch11.stopWait.simulate({ frames: "3", lostAt: "3" }));
    expect(m["重传帧数"]).toBe(1);
  });
  it("co.float-add：右规后阶码加一", () => {
    const m = lastM(batch10.floatAdd.simulate({ am: "1.875", ae: "1", bm: "1.875", be: "1" }));
    expect(m["尾数"]).toBeCloseTo(1.875, 6);
    expect(m["阶码"]).toBe(2);
  });
  it("os.multilevel-page-table：一级未分配时没有 DONE 帧", () => {
    const sim = batch11.pageTable2.simulate({ vaddr: "7:0:0" });
    expect(sim.frames.map((f: any) => f.event.type)).not.toContain("DONE");
  });
  it("os.process-state：含挂起激活走完 8 步", () => {
    const m = lastM(batch10.processState.simulate({ events: "create,ready,run,block,suspend,resume,run,terminate" }));
    expect(m["事件数"]).toBe(8);
    expect(m["最终状态"]).toBe("终止");
  });
  it("ds.critical-path：有环时给出提示帧", () => {
    const sim = batch10.criticalPath.simulate({ edges: "1,2,3;2,1,2;1,3,1" });
    expect(sim.frames[0]!.narration).toContain("环");
  });
});
