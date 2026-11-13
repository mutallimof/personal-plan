import { createFileRoute } from "@tanstack/react-router";
import { PantryHome } from "@/features/pantry/PantryHome";
import { parsePantrySearch } from "@/features/pantry/sheets";

export const Route = createFileRoute("/_authenticated/_shell/pantry/")({
  validateSearch: parsePantrySearch,
  component: Page,
});

function Page() {
  return <PantryHome search={Route.useSearch()} />;
}
