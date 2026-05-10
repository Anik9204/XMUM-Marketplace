import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface DarkModeCtx {
  dark: boolean;
  toggle: () => void;
}

const Ctx = createContext<DarkModeCtx>({ dark: false, toggle: () => {} });

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("xmum-theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      localStorage.setItem("xmum-theme", prefersDark ? "dark" : "light");
      return prefersDark;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("xmum-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export function useDarkMode() {
  return useContext(Ctx);
}
