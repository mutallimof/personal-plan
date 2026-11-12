import { useSyncExternalStore } from "react";

/** Look of the app on this device: one of three themes, and light, dark or whatever the system says. */
export const THEMES = [
  { id: "garden", label: "Garden", fonts: "Bricolage Grotesque + Figtree", swatch: ["#F7F6F0", "#22C55E", "#10261C"] },
  { id: "clay", label: "Clay", fonts: "Fraunces + DM Sans", swatch: ["#F6F1E8", "#B85C38", "#33261C"] },
  { id: "tide", label: "Tide", fonts: "Space Grotesk + IBM Plex Sans", swatch: ["#F4F6FA", "#2F5BD8", "#131C36"] },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

export const MODES = ["system", "light", "dark"] as const;
export type Mode = (typeof MODES)[number];

export type Appearance = { theme: ThemeId; mode: Mode };
export const DEFAULT_APPEARANCE: Appearance = { theme: "garden", mode: "system" };

export const APPEARANCE_KEY = "lifeplan.appearance";

/** Browser bar colour per theme: [light, dark]. Close to each theme's --background. */
const BAR: Record<ThemeId, readonly [string, string]> = {
  garden: ["#F7F6F0", "#0D1410"],
  clay: ["#F6F1E8", "#16120E"],
  tide: ["#F4F6FA", "#0C1120"],
};

/** Reads a stored value; anything unknown falls back to the default. */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    const v = JSON.parse(raw) as Partial<Appearance> | null;
    return {
      theme: THEMES.find((t) => t.id === v?.theme)?.id ?? DEFAULT_APPEARANCE.theme,
      mode: MODES.find((m) => m === v?.mode) ?? DEFAULT_APPEARANCE.mode,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export const isDark = (mode: Mode, systemDark: boolean) => mode === "dark" || (mode === "system" && systemDark);

const systemDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function read(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(APPEARANCE_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Puts the choice on <html> (data-theme, .dark) and on the browser bar. */
export function applyAppearance(a: Appearance): void {
  if (typeof document === "undefined") return;
  const dark = isDark(a.mode, systemDark());
  const root = document.documentElement;
  root.dataset["theme"] = a.theme;
  root.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[a.theme][dark ? 1 : 0]);
}

/**
 * Runs in <head> before the first paint, so the page never flashes the wrong theme.
 * Kept as text because it must not wait for the app bundle; it mirrors parseAppearance and applyAppearance.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement,v=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})||"{}")||{},t=${JSON.stringify(THEMES.map((t) => t.id))}.indexOf(v.theme)<0?"garden":v.theme,m=v.mode,k=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);d.dataset.theme=t;d.classList.toggle("dark",k);var b=${JSON.stringify(BAR)},c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",b[t][k?1:0])}catch(e){}})()`;

const listeners = new Set<() => void>();
let current: Appearance | null = null;

function snapshot(): Appearance {
  current ??= read();
  return current;
}

export function setAppearance(patch: Partial<Appearance>): void {
  current = { ...snapshot(), ...patch };
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked: the choice lasts until the page is closed */
  }
  applyAppearance(current);
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystem = () => {
    applyAppearance(snapshot());
    onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== APPEARANCE_KEY) return;
    current = read();
    applyAppearance(current);
    onChange();
  };
  media?.addEventListener?.("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    media?.removeEventListener?.("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => DEFAULT_APPEARANCE;

/** The current choice, and whether the page is dark right now. */
export function useAppearance(): Appearance & { dark: boolean } {
  const a = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return { ...a, dark: isDark(a.mode, systemDark()) };
}
