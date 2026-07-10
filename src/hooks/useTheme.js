"use client";

import { useEffect, useState } from "react";

// Reads/writes the theme applied by the inline script in layout.js and keeps
// localStorage + the <html data-theme> attribute in sync.
export function useTheme() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* ignore write failures (private mode, etc.) */
      }
      return next;
    });
  };

  return { theme, toggle };
}
