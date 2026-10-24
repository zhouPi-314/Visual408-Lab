import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // 根目录下的 tests/ 需要解析工作区包
    alias: {
      "@visual408/storage": r("./packages/storage/src/index.ts"),
      "@visual408/sim-core": r("./packages/sim-core/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
