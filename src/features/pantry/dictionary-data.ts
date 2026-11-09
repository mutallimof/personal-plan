import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planAliasWrites, type Alias, type AliasDraft } from "./aliases";
import { STARTER_ALIASES } from "./starter-aliases";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const CHUNK = 200;

/** Inserts new aliases and updates existing ones with the same text and store. */
export async function writeAliases(drafts: readonly AliasDraft[]): Promise<{ added: number; updated: number }> {
  if (!drafts.length) return { added: 0, updated: 0 };
  const user_id = await uid();
  const existing = check(await supabase.from("product_aliases").select("*")) ?? [];
  const { inserts, updates } = planAliasWrites(existing, drafts);
  for (let i = 0; i < inserts.length; i += CHUNK) {
    check(await supabase.from("product_aliases").insert(inserts.slice(i, i + CHUNK).map((d) => ({ ...d, user_id }))));
  }
  for (const { id, draft } of updates) check(await supabase.from("product_aliases").update(draft).eq("id", id));
  return { added: inserts.length, updated: updates.length };
}

/** Fills the starter dictionary the first time, never again (so entries you delete stay deleted). */
async function ensureStarterAliases(): Promise<void> {
  const user_id = await uid();
  const settings = check(await supabase.from("pantry_settings").select("aliases_seeded").eq("user_id", user_id).maybeSingle());
  if (settings?.aliases_seeded) return;
  const existing = check(await supabase.from("product_aliases").select("*")) ?? [];
  // Only the inserts: entries you already have are left as they are.
  const { inserts } = planAliasWrites(existing, STARTER_ALIASES);
  for (let i = 0; i < inserts.length; i += CHUNK) {
    check(await supabase.from("product_aliases").insert(inserts.slice(i, i + CHUNK).map((d) => ({ ...d, user_id }))));
  }
  check(await supabase.from("pantry_settings").upsert({ user_id, aliases_seeded: true }));
}

export const aliasesQuery = queryOptions({
  queryKey: ["pantry", "aliases"],
  queryFn: async (): Promise<Alias[]> => {
    await ensureStarterAliases();
    return check(await supabase.from("product_aliases").select("*").order("raw_text")) ?? [];
  },
});

export const dictionary = {
  async update(id: string, draft: AliasDraft): Promise<void> {
    check(await supabase.from("product_aliases").update(draft).eq("id", id));
  },
  async remove(id: string): Promise<void> {
    check(await supabase.from("product_aliases").delete().eq("id", id));
  },
};
