import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface DarkModeCtx {
  dark: boolean;
  toggle: () => void;
}

const Ctx = createContext<DarkModeCtx>({ dark: false, toggle: () => {} });

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const userHasToggled = useRef(false);

  const [dark, setDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("xmum-theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
    if (userHasToggled.current) {
      localStorage.setItem("xmum-theme", dark ? "dark" : "light");
    }
  }, [dark]);

  const toggle = () => {
    userHasToggled.current = true;
    setDark((d) => !d);
  };

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export function useDarkMode() {
  return useContext(Ctx);
}
