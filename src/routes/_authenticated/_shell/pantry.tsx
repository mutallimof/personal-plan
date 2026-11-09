import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/pantry")({
  head: () => ({ meta: [{ title: "Pantry — Lifeplan" }, { name: "description", content: "What you have in the kitchen." }] }),
  component: PantryLayout,
});

const TABS = [
  { to: "/pantry", label: "Items", exact: true },
  { to: "/pantry/dictionary", label: "Dictionary", exact: false },
] as const;

function PantryLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pantry</h1>
      <div className="flex gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            className="flex h-11 flex-1 items-center justify-center rounded-full text-sm font-medium text-muted-foreground"
            activeProps={{ className: "bg-background text-foreground shadow-sm" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
