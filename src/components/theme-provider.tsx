"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const STORAGE_KEY = "alliance-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

const applyTheme = (t: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // storage unavailable — non-fatal
  }
};

/**
 * Dependency-free theme provider. Reads the theme from localStorage (falling
 * back to the OS preference), applies the `dark` class to <html> (which the
 * project's Tailwind `@custom-variant dark` reads), and persists changes.
 * The layout injects a tiny inline script that runs before paint to avoid a
 * theme flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        initial = stored;
      } else {
        initial = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } catch {
      initial = "light";
    }
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
