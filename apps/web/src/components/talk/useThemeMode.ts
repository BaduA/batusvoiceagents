"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** The app follows the system theme; the Aura shader needs to know which one is active. */
export function useThemeMode(): "dark" | "light" {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(query).matches ? "dark" : "light"),
    () => "light",
  );
}

export const auraColor = (mode: "dark" | "light") => (mode === "dark" ? "#1fd5f9" : "#002cf2");
