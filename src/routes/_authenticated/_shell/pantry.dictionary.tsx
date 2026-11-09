import { createFileRoute } from "@tanstack/react-router";
import { DictionaryPage } from "@/features/pantry/DictionaryPage";

export const Route = createFileRoute("/_authenticated/_shell/pantry/dictionary")({
  component: DictionaryPage,
});
