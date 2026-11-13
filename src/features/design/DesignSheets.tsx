import { useState, type ReactNode } from "react";
import {
  ArrowUp,
  BookText,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Dumbbell,
  Languages,
  MessageCircle,
  Minus,
  Play,
  Plus,
  Receipt,
  Salad,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { AppearanceSetting } from "@/components/AppearanceSetting";
import { Logo, LogoMark } from "@/components/Logo";
import { Empty, Loading, QueryError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { THEMES } from "@/lib/appearance";
import { cn } from "@/lib/utils";

const COLORS: readonly { name: string; use: string; on?: string }[] = [
  { name: "background", use: "page", on: "foreground" },
  { name: "card", use: "tiles, inputs", on: "foreground" },
  { name: "popover", use: "dialogs, menus", on: "foreground" },
  { name: "foreground", use: "text", on: "background" },
  { name: "primary", use: "main action", on: "primary-foreground" },
  { name: "primary-ink", use: "green text, ring", on: "background" },
  { name: "primary-soft", use: "selection", on: "foreground" },
  { name: "accent", use: "selected chip", on: "accent-foreground" },
  { name: "secondary", use: "tracks, quiet buttons", on: "foreground" },
  { name: "muted-foreground", use: "secondary text", on: "background" },
  { name: "border", use: "hairlines", on: "foreground" },
  { name: "input", use: "control outlines", on: "foreground" },
  { name: "destructive", use: "delete, errors", on: "destructive-foreground" },
  { name: "warning-soft", use: "expires soon", on: "warning-ink" },
];

const ICONS = [Dumbbell, Languages, ShoppingBasket, User, ChefHat, Receipt, Salad, Sparkles, BookText, CalendarDays, Settings, Search, Plus, Trash2, MessageCircle, Play];

function Sheet({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="space-y-3">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

/** The design sheets: every token and shared component on one page. Dev only (see src/routes/design.tsx). */
export default function DesignSheets() {
  const [tab, setTab] = useState("Can cook");
  const [on, setOn] = useState(true);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set(["Eggs"]));

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 pb-24 pt-6 sm:px-8">
      <header className="space-y-4">
        <Logo />
        <h1 className="text-[1.75rem] leading-tight">Design sheets</h1>
        <AppearanceSetting />
      </header>

      <Sheet id="logo" title="Logo and app icon">
        <div className="tile grid gap-6 p-5 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-4">
            <LogoMark className="h-24 w-24" animated />
            <Logo />
            <div className="flex items-end gap-3">
              <LogoMark className="h-12 w-12" />
              <LogoMark className="h-8 w-8" />
              <LogoMark className="h-5 w-5" />
              <LogoMark className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <figure className="space-y-1 text-center text-xs text-muted-foreground">
                <img src="/icons/icon-192.png" alt="App icon" className="h-20 w-20" />
                <figcaption>Icon</figcaption>
              </figure>
              <figure className="space-y-1 text-center text-xs text-muted-foreground">
                <img src="/icons/icon-maskable-512.png" alt="Maskable icon in a circle" className="h-20 w-20 rounded-full" />
                <figcaption>Maskable</figcaption>
              </figure>
              <figure className="space-y-1 text-center text-xs text-muted-foreground">
                <img src="/icons/apple-touch-icon.png" alt="iOS icon" className="h-20 w-20 rounded-[22%]" />
                <figcaption>iOS</figcaption>
              </figure>
              <figure className="space-y-1 text-center text-xs text-muted-foreground">
                <img src="/favicon.svg" alt="Favicon" className="h-4 w-4" />
                <figcaption>16</figcaption>
              </figure>
            </div>
            <div className="flex gap-3">
              {THEMES.map((t) => (
                <span key={t.id} data-theme={t.id} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  <LogoMark className="h-12 w-12" />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet id="palette" title="Palette">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLORS.map((c) => (
            <div key={c.name} className="tile overflow-hidden">
              <div className="flex h-16 items-end p-2 text-sm font-semibold" style={{ background: `var(--${c.name})`, color: c.on ? `var(--${c.on})` : undefined }}>
                Aa
              </div>
              <div className="border-t px-2.5 py-2">
                <p className="truncate text-xs font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet id="type" title="Typography">
        <div className="tile space-y-4 p-5">
          <p className="font-heading text-5xl font-extrabold leading-none">Lifeplan</p>
          <h1 className="text-[1.75rem] leading-tight">Page title, 28</h1>
          <h2 className="text-xl font-semibold">Section title, 20</h2>
          <h3 className="font-semibold">Card title, 16</h3>
          <p className="font-heading text-3xl font-bold tabular-nums">1,840 kcal</p>
          <p>Body, 16. Salmon with rice and peas, two portions, ready in 25 minutes.</p>
          <p className="text-sm text-muted-foreground">Secondary, 14. 620 kcal · 42 g protein per serving</p>
          <p className="text-xs font-medium">Caption, 12</p>
          <p className="eyebrow">Eyebrow, 11</p>
        </div>
      </Sheet>

      <Sheet id="buttons" title="Buttons">
        <div className="tile space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Button>Cook this</Button>
            <Button variant="outline">Edit</Button>
            <Button variant="secondary">Example plan</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button>
              <Plus /> Add item
            </Button>
            <Button variant="outline">
              <Receipt /> Add receipt
            </Button>
            <Button size="icon" aria-label="Send" className="rounded-full">
              <ArrowUp />
            </Button>
            <Button size="icon" variant="outline" aria-label="Settings">
              <Settings />
            </Button>
            <Button size="sm" variant="secondary">
              Small
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <Button size="lg" className="w-full">
            Save
          </Button>
        </div>
      </Sheet>

      <Sheet id="inputs" title="Inputs">
        <div className="tile space-y-3 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search" placeholder="Search" className="pl-10" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Name" defaultValue="Chicken breast" />
            <Select defaultValue="g">
              <SelectTrigger aria-label="Unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="g">g</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="pieces">pieces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea aria-label="Steps" placeholder="Steps" />
          <label className="flex min-h-11 items-center justify-between text-sm font-medium">
            AI cooking chat
            <Switch checked={on} onCheckedChange={setOn} aria-label="AI cooking chat" />
          </label>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Less" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-input bg-card">
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-16 text-center text-sm font-semibold tabular-nums">500 g</span>
            <button type="button" aria-label="More" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-input bg-card">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Beginner", "Intermediate", "Advanced"].map((l, i) => (
              <span key={l} className={cn("flex h-11 items-center rounded-full border px-4 text-sm font-medium", i === 1 ? "border-primary-ink bg-accent text-accent-foreground" : "border-input bg-card text-muted-foreground")}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet id="cards" title="Cards">
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="tile space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">Salmon, rice and peas</h3>
              <span className="shrink-0 text-xs text-muted-foreground">2 servings</span>
            </div>
            <p className="text-sm text-muted-foreground">620 kcal · 42 g protein per serving</p>
            <span className="inline-block rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink">Uses food that expires soon</span>
            <div className="flex gap-2 pt-1">
              <Button>Cook this</Button>
              <Button variant="outline">Edit</Button>
            </div>
          </article>
          <div className="space-y-3">
            <section className="flex items-center justify-between gap-3 rounded-2xl bg-accent p-4">
              <div className="min-w-0">
                <p className="eyebrow text-accent-foreground">Next</p>
                <p className="font-heading truncate text-lg font-semibold">Push day</p>
                <p className="text-sm text-muted-foreground">~55 min</p>
              </div>
              <Button>
                <Play /> Start
              </Button>
            </section>
            <div className="tile p-4">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="font-heading text-3xl font-bold tabular-nums">1,840 kcal</p>
              <p className="text-sm text-muted-foreground">112 g protein · 190 g carbs · 61 g fat</p>
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet id="tabs" title="Tabs">
        <div className="space-y-3">
          <div role="tablist" aria-label="Example" className="seg">
            {["Can cook", "Recipes", "Shopping"].map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className="seg-item" onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="mx-auto flex w-fit items-center gap-1 rounded-full border bg-card p-1.5 shadow-pop">
            {[Dumbbell, Languages, ShoppingBasket, User].map((Icon, i) => (
              <span key={i} className={cn("flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold", i === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" strokeWidth={i === 2 ? 2.4 : 2} />
                {i === 2 && "Pantry"}
              </span>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet id="lists" title="Lists">
        <div className="grid gap-3 sm:grid-cols-2">
          <ul className="tile divide-y">
            {["Eggs", "Basmati rice", "Lemons"].map((name) => (
              <li key={name} className="flex min-h-13 items-center gap-3 px-4">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  aria-label={`Bought ${name}`}
                  checked={done.has(name)}
                  onChange={() => {
                    const next = new Set(done);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    setDone(next);
                  }}
                />
                <span className={cn("flex-1 text-sm", done.has(name) && "text-muted-foreground line-through")}>{name}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${name}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <ul className="tile divide-y">
            {[
              { label: "Appearance", icon: Sparkles },
              { label: "Dictionary", icon: BookText },
              { label: "Nutrition table", icon: Salad },
            ].map(({ label, icon: Icon }) => (
              <li key={label}>
                <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <Sheet id="states" title="Empty, loading, error">
        <div className="grid gap-3 sm:grid-cols-3">
          <Empty action={<Button>Add recipe</Button>}>No recipes yet.</Empty>
          <Loading rows={2} className="h-16" />
          <QueryError onRetry={() => {}} />
        </div>
      </Sheet>

      <Sheet id="icons" title="Icons">
        <div className="tile grid grid-cols-8 gap-y-4 p-5">
          {ICONS.map((Icon, i) => (
            <span key={i} className="flex justify-center">
              <Icon className="h-5 w-5" />
            </span>
          ))}
        </div>
        <div className="tile flex flex-wrap gap-3 p-5">
          {["apple", "avocado", "bread", "carrot", "cheese", "egg", "fish", "milk", "tomato", "pasta"].map((n) => (
            <img key={n} src={`/icons/food/${n}.svg`} alt={n} className="h-8 w-8" />
          ))}
        </div>
      </Sheet>
    </main>
  );
}
