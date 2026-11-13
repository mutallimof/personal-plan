import { queryOptions } from "@tanstack/react-query";
import { ensureDefaultLocations } from "@/features/pantry/data";
import { defaultAccepts } from "@/features/pantry/locations";
import type { PantryLocation } from "@/features/pantry/model";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { readLayout, type Layout } from "./layout";
import { DEFAULT_LAYOUT, fromLegacyZones, type LegacyZone } from "./legacy";
import { missingPlaces, type NewPlace } from "./places";
import { moveOutOfRemoved, tidyLayout, upgradeLayout } from "./upgrade";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Creates the pantry places a layout names that do not exist yet (parents first). */
async function createPlaces(
  wanted: readonly NewPlace[],
  existing: readonly PantryLocation[],
  user_id: string,
): Promise<void> {
  const ids = new Map(existing.map((l) => [l.name.toLowerCase(), l.id]));
  for (const [i, p] of wanted.entries()) {
    const row = check(
      await supabase
        .from("pantry_locations")
        .insert({
          user_id,
          name: p.name,
          kind: p.kind,
          position: existing.length + i,
          accepts: defaultAccepts(p.name),
          parent_id: p.parent ? (ids.get(p.parent.toLowerCase()) ?? null) : null,
        })
        .select("id")
        .single(),
    );
    if (!row) throw new Error("No data returned");
    ids.set(p.name.toLowerCase(), row.id);
  }
}

/** Saves the layout (one document) and creates the places it needs. Existing places and items are never touched. */
export async function saveLayout(layout: Layout): Promise<void> {
  const user_id = await uid();
  const places = check(await supabase.from("pantry_locations").select("*")) ?? [];
  await createPlaces(missingPlaces(layout, places), places, user_id);
  check(
    await supabase
      .from("kitchen_layouts")
      .upsert({ user_id, layout: layout as unknown as Json, updated_at: new Date().toISOString() }),
  );
}

/** The earlier flat map, as zones with place names, or none. */
async function legacyZones(): Promise<LegacyZone[]> {
  const zones = check(await supabase.from("kitchen_zones").select("*").order("position")) ?? [];
  if (!zones.length) return [];
  const places = check(await supabase.from("pantry_locations").select("id,name")) ?? [];
  return zones.map((z) => ({
    key: z.id,
    name: z.name,
    kind: z.kind,
    parent: z.parent_id,
    location: places.find((p) => p.id === z.location_id)?.name ?? null,
  }));
}

/** Moves the items of removed places to sensible shelves. Places are never deleted. */
async function moveItemsOut(removed: readonly string[], stayInCabinet: readonly string[]): Promise<void> {
  const places = check(await supabase.from("pantry_locations").select("*")) ?? [];
  const items = check(await supabase.from("pantry_items").select("id,category,location_id")) ?? [];
  for (const m of moveOutOfRemoved(items, places, removed, stayInCabinet))
    check(await supabase.from("pantry_items").update({ location_id: m.location_id, shelf: null }).eq("id", m.id));
}

/**
 * Brings a saved layout up to date, each step once: the default fridge and freezer compartments it lacks (nothing
 * removed), then the one-time tidy-ups by layout revision (no Top/Middle/Bottom drawers, only Meat and fish is a drawer, plants
 * on the worktop), which also move the items of removed drawers to shelves that fit them.
 */
async function upgradeOnce(user_id: string, saved: Layout): Promise<Layout> {
  let layout = saved;
  const settings = check(await supabase.from("pantry_settings").select("layout_upgraded").eq("user_id", user_id).maybeSingle());
  if (!settings?.layout_upgraded) {
    const up = upgradeLayout(saved);
    if (up.added.length) {
      layout = up.layout;
      await saveLayout(layout);
    }
    check(await supabase.from("pantry_settings").upsert({ user_id, layout_upgraded: true }));
  }
  const tidy = tidyLayout(layout);
  if (tidy.layout !== layout) {
    if (tidy.removed.length) await moveItemsOut(tidy.removed, tidy.stayInCabinet);
    await saveLayout(tidy.layout);
    layout = tidy.layout;
  }
  return layout;
}

/**
 * The layout, created on first use: converted from the earlier flat map when there is one, else the default.
 * A saved layout that cannot be read is not overwritten; the default is shown until a new one is imported.
 */
async function loadOrCreateLayout(): Promise<Layout> {
  const user_id = await uid();
  const row = check(
    await supabase.from("kitchen_layouts").select("layout").eq("user_id", user_id).maybeSingle(),
  );
  if (row) {
    const saved = readLayout(row.layout).layout;
    if (!saved) return DEFAULT_LAYOUT;
    return upgradeOnce(user_id, saved);
  }

  await ensureDefaultLocations();
  const zones = await legacyZones();
  const layout = zones.length ? fromLegacyZones(zones).layout : DEFAULT_LAYOUT;
  await saveLayout(layout);
  return layout;
}

export const layoutQuery = queryOptions({
  queryKey: ["pantry", "layout"],
  queryFn: loadOrCreateLayout,
});
