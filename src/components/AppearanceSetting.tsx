import { Check, Monitor, Moon, Sun } from "lucide-react";
import { MODES, THEMES, setAppearance, useAppearance, type Mode } from "@/lib/appearance";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<Mode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const MODE_LABEL: Record<Mode, string> = { system: "System", light: "Light", dark: "Dark" };

/** Theme and light/dark choice. Stored on this device only. */
export function AppearanceSetting() {
  const { theme, mode, dark } = useAppearance();
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const on = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAppearance({ theme: t.id })}
              className={cn(
                "tile press flex items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-col sm:items-stretch",
                on && "border-primary-ink ring-1 ring-primary-ink",
              )}
            >
              <span data-theme={t.id} className={cn("flex h-14 w-20 shrink-0 items-end gap-1.5 rounded-lg border bg-background p-2 sm:h-20 sm:w-full", dark && "dark")}>
                <span className="h-full flex-1 rounded-md border bg-card" />
                <span className="h-2/3 w-4 rounded-full bg-primary" />
                <span className="h-1/3 w-4 rounded-full bg-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  {t.label}
                  {on && <Check className="h-4 w-4 text-primary-ink" aria-hidden="true" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{t.fonts}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label="Mode" className="seg">
        {MODES.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <button key={m} type="button" role="radio" aria-checked={m === mode} data-on={m === mode} onClick={() => setAppearance({ mode: m })} className="seg-item gap-2">
              <Icon className="h-4 w-4" aria-hidden="true" /> {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
