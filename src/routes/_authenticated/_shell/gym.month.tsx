import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/_authenticated/_shell/gym/month")({
  head: () => ({ meta: [{ title: "Month — Lifeplan" }] }),
  component: () => <ComingSoon title="Month" />,
});
