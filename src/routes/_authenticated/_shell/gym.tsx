import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/gym")({
  head: () => ({ meta: [{ title: "Gym — Lifeplan" }, { name: "description", content: "Your gym plan, week and month." }] }),
  component: GymLayout,
});

const TABS = [
  { to: "/gym", label: "Plan", exact: true },
  { to: "/gym/week", label: "Week", exact: false },
  { to: "/gym/month", label: "Month", exact: false },
  { to: "/gym/library", label: "Library", exact: false },
] as const;

function GymLayout() {
  return (
    <div className="space-y-6">
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
