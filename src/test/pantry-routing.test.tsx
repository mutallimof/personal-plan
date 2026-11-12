import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// The old tab addresses still exist as small redirect routes (see legacyTarget in sheets.ts).
describe("Pantry routes", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it.each([
    ["/pantry", "/_authenticated/_shell/pantry/"],
    ["/pantry/receipt", "/_authenticated/_shell/pantry/receipt"],
    ["/pantry/dictionary", "/_authenticated/_shell/pantry/dictionary"],
    ["/pantry/kitchen", "/_authenticated/_shell/pantry/kitchen"],
    ["/pantry/cook", "/_authenticated/_shell/pantry/cook"],
  ])("%s matches a route inside the Pantry layout", (path, routeId) => {
    const matches = router.matchRoutes(path);
    expect(matches.at(-1)?.routeId).toBe(routeId);
    expect(matches.map((m) => m.routeId)).toContain("/_authenticated/_shell/pantry");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
