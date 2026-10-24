import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 相对路径：GitHub Pages 项目页（/Visual408-Lab/）与 Cloudflare Pages 根路径都能用
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // 原子写入会短暂产生 .tmpdir/*.tmp，watch 到会 EBUSY 直接崩掉 dev server
    watch: { ignored: ["**/.tmpdir/**", "**/*.tmpdir/**", "**/*.tmp"] },
  },
  optimizeDeps: { exclude: ["@visual408/sim-core", "@visual408/storage"] },
});