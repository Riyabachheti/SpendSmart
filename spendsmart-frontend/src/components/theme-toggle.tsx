import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { getInitialTheme, persistTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const nextTheme = theme === "light" ? "dark" : "light";

  function toggleTheme() {
    setTheme(nextTheme);
    persistTheme(nextTheme);
  }

  return (
    <button
      aria-label={`Use ${nextTheme} theme`}
      className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={toggleTheme}
      title={`Use ${nextTheme} theme`}
      type="button"
    >
      {theme === "light" ? <Moon aria-hidden="true" className="size-4" /> : <Sun aria-hidden="true" className="size-4" />}
    </button>
  );
}
