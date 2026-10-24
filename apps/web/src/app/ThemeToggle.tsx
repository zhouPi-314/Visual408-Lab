import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "v408-theme";

function initialTheme(): Theme {
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * 暗色/浅色切换小模块：
 * - 首次访问跟随系统偏好；
 * - 手动切换后写入 localStorage，下次直接生效；
 * - 通过 <html data-theme> 覆盖 CSS 令牌，不依赖组件重渲染。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="btn theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      title={dark ? "切换到浅色模式" : "切换到深色模式"}
    >
      <span aria-hidden="true">{dark ? "☾" : "☀"}</span>
      <span className="theme-label">{dark ? "深色" : "浅色"}</span>
    </button>
  );
}