export type Theme = "light" | "dark";

const themeStorageKey = "spendsmart-theme";

export function getInitialTheme(): Theme {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: Theme) {
  window.localStorage.setItem(themeStorageKey, theme);
  applyTheme(theme);
}
