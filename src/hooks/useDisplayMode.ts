import { useCallback, useEffect, useState } from "react";

import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";

export type DisplayMode = "dark" | "light" | "book";

const STORAGE_KEY = "probpera-display-mode";
const EVENT_NAME = "probpera:display-mode";

function isDisplayMode(value: unknown): value is DisplayMode {
  return value === "dark" || value === "light" || value === "book";
}

function preferredMode(): DisplayMode {
  if (typeof window === "undefined") return "dark";
  const stored = readWebStorage("local", STORAGE_KEY);
  return isDisplayMode(stored) ? stored : "dark";
}

function applyMode(mode: DisplayMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme =
    mode === "dark" ? "dark" : "light";
}

export function useDisplayMode() {
  const [mode, setLocalMode] = useState<DisplayMode>(preferredMode);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  useEffect(() => {
    const syncMode = (event: Event) => {
      const nextMode = (event as CustomEvent<DisplayMode>).detail;
      if (isDisplayMode(nextMode)) setLocalMode(nextMode);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isDisplayMode(event.newValue)) {
        setLocalMode(event.newValue);
      }
    };
    window.addEventListener(EVENT_NAME, syncMode);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, syncMode);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const setMode = useCallback((nextMode: DisplayMode) => {
    setLocalMode(nextMode);
    writeWebStorage("local", STORAGE_KEY, nextMode);
    applyMode(nextMode);
    window.dispatchEvent(
      new CustomEvent<DisplayMode>(EVENT_NAME, { detail: nextMode })
    );
  }, []);

  return { mode, setMode };
}
