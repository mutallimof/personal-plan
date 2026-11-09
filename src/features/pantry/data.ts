import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { findDuplicate, mergePatch } from "./items";
import { DEFAULT_LOCATIONS } from "./locations";
import type { PantryItem, PantryLocation } from "./model";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Creates the default places the first time, never again (so places you delete stay deleted). */
async function ensureDefaultLocations(): Promise<void> {
  const user_id = await uid();
  const settings = check(await supabase.from("pantry_settings").select("*").eq("user_id", user_id).maybeSingle());
  if (settings?.locations_seeded) return;

  const existing = check(await supabase.from("pantry_locations").select("id").limit(1)) ?? [];
  if (!existing.length) {
    const ids = new Map<string, string>();
    for (const [position, l] of DEFAULT_LOCATIONS.entries()) {
      const row = check(
        await supabase
          .from("pantry_locations")
          .insert({ user_id, name: l.name, kind: l.kind, position, parent_id: l.parent ? (ids.get(l.parent) ?? null) : null })
          .select("id")
          .single(),
      );
      if (!row) throw new Error("No data returned");
      ids.set(l.name, row.id);
    }
  }
  check(await supabase.from("pantry_settings").upsert({ user_id, locations_seeded: true }));
}

export const locationsQuery = queryOptions({
  queryKey: ["pantry", "locations"],
  queryFn: async (): Promise<PantryLocation[]> => {
    await ensureDefaultLocations();
    return check(await supabase.from("pantry_locations").select("*").order("position")) ?? [];
  },
});

export const itemsQuery = queryOptions({
  queryKey: ["pantry", "items"],
  queryFn: async (): Promise<PantryItem[]> => check(await supabase.from("pantry_items").select("*").order("name")) ?? [],
});

export type PantrySettings = { aiCheck: boolean; aiLinesSent: number };

export const settingsQuery = queryOptions({
  queryKey: ["pantry", "settings"],
  queryFn: async (): Promise<PantrySettings> => {
    const user_id = await uid();
    const row = check(await supabase.from("pantry_settings").select("*").eq("user_id", user_id).maybeSingle());
    return { aiCheck: row?.ai_check ?? false, aiLinesSent: row?.ai_lines_sent ?? 0 };
  },
});

export function useInvalidatePantry() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pantry"] });
}

export type NewItem = Omit<TablesInsert<"pantry_items">, "id" | "user_id" | "added_at">;

export const pantry = {
  async setAiCheck(on: boolean): Promise<void> {
    const user_id = await uid();
    check(await supabase.from("pantry_settings").upsert({ user_id, ai_check: on }));
  },
  /**
   * Adds an item. If the same name and unit already sit in the same place, adds to that item instead
   * and returns it; returns null when a new row was created.
   */
  async addItem(item: NewItem): Promise<PantryItem | null> {
    const user_id = await uid();
    const unit = item.unit ?? "pieces";
    const locationId = item.location_id ?? null;
    const base = supabase.from("pantry_items").select("*").eq("unit", unit);
    const sameSpot = check(await (locationId ? base.eq("location_id", locationId) : base.is("location_id", null))) ?? [];
    const same = findDuplicate(sameSpot, { name: item.name, unit, location_id: locationId });
    if (same) {
      check(await supabase.from("pantry_items").update(mergePatch(same, item)).eq("id", same.id));
      return same;
    }
    check(await supabase.from("pantry_items").insert({ ...item, user_id }));
    return null;
  },
  async updateItem(id: string, patch: TablesUpdate<"pantry_items">): Promise<void> {
    check(await supabase.from("pantry_items").update(patch).eq("id", id));
  },
  async removeItem(id: string): Promise<void> {
    check(await supabase.from("pantry_items").delete().eq("id", id));
  },
};
