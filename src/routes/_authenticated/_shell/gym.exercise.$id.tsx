import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/_authenticated/_shell/gym/exercise/$id")({
  validateSearch: (s: Record<string, unknown>): { item?: string | undefined } => ({
    item: typeof s["item"] === "string" ? s["item"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Exercise — Lifeplan" }] }),
  component: () => <ComingSoon title="Exercise" />,
});
