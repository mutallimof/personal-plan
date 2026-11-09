import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { ensureDefaultLocations } from "./data";
import { DEFAULT_LAYOUT, parentsFirst, type Layout, type Zone } from "./kitchen";
import type { LocationKind, PantryLocation } from "./model";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function checkRow<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("No data returned");
  return res.data;
}

/**
 * Replaces the layout. Places named in the layout are reused, or created when missing. The new zones are added
 * first and the old ones removed after, so a failure part-way does not leave an empty kitchen.
 */
export async function applyLayout(layout: Layout): Promise<void> {
  const user_id = await uid();
  const places: PantryLocation[] = check(await supabase.from("pantry_locations").select("*")) ?? [];
  const old = check(await supabase.from("kitchen_zones").select("id")) ?? [];
  const ordered = parentsFirst(layout.zones);

  const placeByName = (name: string) => places.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const zoneIds = new Map<string, string>();
  const placeOfZone = new Map<string, string | null>();
  const created: string[] = [];
  try {
    for (const [position, z] of ordered.entries()) {
      let placeId: string | null = null;
      if (z.location) {
        let place = placeByName(z.location);
        if (!place) {
          const parentPlace = z.parent ? (placeOfZone.get(z.parent) ?? null) : null;
          place = checkRow(
            await supabase
              .from("pantry_locations")
              .insert({ user_id, name: z.location, kind: z.kind, parent_id: parentPlace, position: places.length })
              .select("*")
              .single(),
          );
          places.push(place);
        }
        placeId = place.id;
      }
      placeOfZone.set(z.key, placeId);
      const row = checkRow(
        await supabase
          .from("kitchen_zones")
          .insert({
            user_id,
            name: z.name,
            kind: z.kind,
            x: z.x,
            y: z.y,
            width: z.width,
            height: z.height,
            position,
            parent_id: z.parent ? (zoneIds.get(z.parent) ?? null) : null,
            location_id: placeId,
          })
          .select("id")
          .single(),
      );
      zoneIds.set(z.key, row.id);
      created.push(row.id);
    }
  } catch (e) {
    if (created.length) await supabase.from("kitchen_zones").delete().in("id", created);
    throw e;
  }
  if (old.length) {
    check(await supabase.from("kitchen_zones").delete().in("id", old.map((o) => o.id)));
  }
}

/** Creates the default layout the first time, never again (so a layout you clear stays cleared). */
async function ensureDefaultKitchen(): Promise<void> {
  const user_id = await uid();
  const settings = check(await supabase.from("pantry_settings").select("kitchen_seeded").eq("user_id", user_id).maybeSingle());
  if (settings?.kitchen_seeded) return;
  await ensureDefaultLocations();
  const existing = check(await supabase.from("kitchen_zones").select("id").limit(1)) ?? [];
  if (!existing.length) await applyLayout(DEFAULT_LAYOUT);
  check(await supabase.from("pantry_settings").upsert({ user_id, kitchen_seeded: true }));
}

export const zonesQuery = queryOptions({
  queryKey: ["pantry", "zones"],
  queryFn: async (): Promise<Zone[]> => {
    await ensureDefaultKitchen();
    return check(await supabase.from("kitchen_zones").select("*").order("position")) ?? [];
  },
});

export const kitchen = {
  /** A new zone with a pantry place of the same name, so items can be put in it right away. */
  async addZone(name: string, kind: LocationKind, rect: { x: number; y: number; width: number; height: number }, position: number) {
    const user_id = await uid();
    const place = checkRow(
      await supabase.from("pantry_locations").insert({ user_id, name, kind, position: 100 + position }).select("id").single(),
    );
    return checkRow(
      await supabase
        .from("kitchen_zones")
        .insert({ user_id, name, kind, ...rect, position, location_id: place.id })
        .select("*")
        .single(),
    );
  },
  async updateZone(id: string, patch: TablesUpdate<"kitchen_zones">) {
    check(await supabase.from("kitchen_zones").update(patch).eq("id", id));
  },
  /** Saves position and size of several zones, for example after a drag. */
  async saveRects(zones: readonly Pick<Zone, "id" | "x" | "y" | "width" | "height">[]) {
    for (const z of zones) {
      check(await supabase.from("kitchen_zones").update({ x: z.x, y: z.y, width: z.width, height: z.height }).eq("id", z.id));
    }
  },
  /** Removes a zone and the zones inside it. Its pantry place and the items in it stay. */
  async removeZone(id: string) {
    check(await supabase.from("kitchen_zones").delete().eq("id", id));
  },
};
