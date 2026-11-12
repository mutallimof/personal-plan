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
      <div className="seg">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            className="seg-item"
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
