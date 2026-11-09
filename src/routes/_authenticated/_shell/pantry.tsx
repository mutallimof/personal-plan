import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/pantry")({
  head: () => ({ meta: [{ title: "Pantry — Lifeplan" }, { name: "description", content: "What you have in the kitchen." }] }),
  component: () => <Outlet />,
});
