// @vitest-environment node
// Runs the cooking migration (0008) against an in-memory Postgres (PGlite) to check what the app cannot check
// itself: the SQL parses, runs twice, row-level security keeps users apart, and cook/undo change the pantry
// in one step. A tiny stand-in for Supabase's `auth.uid()` and roles is created first.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sql = (file: string) => readFileSync(join(process.cwd(), "migrations", file), "utf8");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

async function as(user: string | null) {
  await db.exec("RESET ROLE");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  if (user) await db.exec("SET ROLE authenticated");
}

async function addItem(user: string, id: string, name: string, quantity: number, unit = "g", location: string | null = null) {
  await as(user);
  await db.query("insert into pantry_items (id, name, quantity, unit, location_id) values ($1, $2, $3, $4, $5)", [id, name, quantity, unit, location]);
}

const qty = async (id: string) => (await db.query<{ quantity: string }>("select quantity from pantry_items where id = $1", [id])).rows[0]?.quantity;

function cookArgs(changes: unknown[]) {
  return ["Rice and eggs", 2, 800, 30, 1, JSON.stringify(changes)] as const;
}

async function cookRecipe(changes: unknown[]) {
  const [title, servings, kcal, protein, missing, json] = cookArgs(changes);
  const res = await db.query<{ cook_recipe: string }>("select cook_recipe(null, $1, $2, $3, $4, $5, $6::jsonb)", [title, servings, kcal, protein, missing, json]);
  return res.rows[0]?.cook_recipe as string;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated;
    create role service_role;
    grant usage on schema public to authenticated, service_role;
    grant usage on schema auth to authenticated, service_role;
  `);
  await db.exec(sql("0004_pantry.sql"));
  await db.exec(sql("0005_product_aliases.sql"));
  await db.exec(sql("0008_recipes.sql"));
  await db.exec(sql("0009_kitchen_scene.sql"));
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("0008_recipes.sql", () => {
  it("can be run again without error", async () => {
    await db.exec("RESET ROLE");
    await db.exec(sql("0008_recipes.sql"));
  });

  it("turns on row-level security for every new table", async () => {
    await db.exec("RESET ROLE");
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('recipes','recipe_ingredients','ingredient_nutrition','cooked_log')",
    );
    expect(res.rows).toHaveLength(4);
    expect(res.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

describe("row-level security", () => {
  it("keeps recipes private to their owner", async () => {
    await as(ALICE);
    await db.exec("insert into recipes (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Alice soup')");
    await as(BOB);
    expect((await db.query("select * from recipes")).rows).toHaveLength(0);
    await as(ALICE);
    expect((await db.query("select * from recipes")).rows).toHaveLength(1);
  });

  it("does not let you add an ingredient to someone else's recipe", async () => {
    await as(BOB);
    await expect(
      db.exec("insert into recipe_ingredients (recipe_id, name, quantity, unit) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sneaky', 1, 'g')"),
    ).rejects.toThrow();
  });

  it("does not let you write a row for another user", async () => {
    await as(BOB);
    await expect(db.query("insert into ingredient_nutrition (user_id, name, basis, kcal, protein_g) values ($1, 'X', '100g', 1, 1)", [ALICE])).rejects.toThrow();
  });

  it("allows one nutrition row per food and basis", async () => {
    await as(ALICE);
    await db.exec("insert into ingredient_nutrition (name, basis, kcal, protein_g) values ('Rice', '100g', 360, 7)");
    await expect(db.exec("insert into ingredient_nutrition (name, basis, kcal, protein_g) values ('rice', '100g', 1, 1)")).rejects.toThrow();
    await db.exec("insert into ingredient_nutrition (name, basis, kcal, protein_g) values ('Rice', 'piece', 1, 1)");
  });

  it("rejects values the app should never send", async () => {
    await as(ALICE);
    await expect(db.exec("insert into recipes (title, servings) values ('Bad', 0)")).rejects.toThrow();
    await expect(db.exec("insert into ingredient_nutrition (name, basis, kcal, protein_g) values ('Y', 'cup', 1, 1)")).rejects.toThrow();
  });
});

describe("cook_recipe", () => {
  it("lowers one item, removes another, and writes the log", async () => {
    await addItem(ALICE, "cccccccc-0000-0000-0000-000000000001", "Rice", 1000);
    await addItem(ALICE, "cccccccc-0000-0000-0000-000000000002", "Eggs", 2, "pieces");
    const logId = await cookRecipe([
      { id: "cccccccc-0000-0000-0000-000000000001", after: 600 },
      { id: "cccccccc-0000-0000-0000-000000000002", after: 0 },
    ]);
    expect(await qty("cccccccc-0000-0000-0000-000000000001")).toBe("600");
    expect(await qty("cccccccc-0000-0000-0000-000000000002")).toBeUndefined();
    const log = (await db.query<{ title: string; servings: string; kcal: string; kcal_missing: number; removed: unknown[] }>("select * from cooked_log where id = $1", [logId])).rows[0];
    expect(log).toMatchObject({ title: "Rice and eggs", servings: "2", kcal: "800", kcal_missing: 1 });
    expect(log?.removed).toHaveLength(2);
  });

  it("changes nothing if any part fails", async () => {
    await addItem(ALICE, "cccccccc-0000-0000-0000-000000000003", "Flour", 500);
    await addItem(ALICE, "cccccccc-0000-0000-0000-000000000004", "Sugar", 100);
    await as(ALICE);
    const before = (await db.query("select count(*)::int as n from cooked_log")).rows[0];
    await expect(
      cookRecipe([
        { id: "cccccccc-0000-0000-0000-000000000003", after: 100 },
        { id: "cccccccc-0000-0000-0000-000000000004", after: 999 }, // more than there is
      ]),
    ).rejects.toThrow(/Invalid amount for Sugar/);
    expect(await qty("cccccccc-0000-0000-0000-000000000003")).toBe("500");
    expect(await qty("cccccccc-0000-0000-0000-000000000004")).toBe("100");
    expect((await db.query("select count(*)::int as n from cooked_log")).rows[0]).toEqual(before);
  });

  it("refuses an item that belongs to someone else", async () => {
    await as(BOB);
    await expect(cookRecipe([{ id: "cccccccc-0000-0000-0000-000000000003", after: 0 }])).rejects.toThrow(/no longer there/);
    await as(ALICE);
    expect(await qty("cccccccc-0000-0000-0000-000000000003")).toBe("500");
  });

  it("refuses a negative amount and a missing sign-in", async () => {
    await as(ALICE);
    await expect(cookRecipe([{ id: "cccccccc-0000-0000-0000-000000000003", after: -1 }])).rejects.toThrow(/Invalid amount/);
    await db.exec("RESET ROLE");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("SET ROLE authenticated");
    await expect(cookRecipe([])).rejects.toThrow(/Not signed in/);
  });
});

describe("undo_cook", () => {
  it("puts back what was lowered and brings back what was removed", async () => {
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000001", "Pasta", 500);
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000002", "Tomatoes", 3, "pieces");
    const logId = await cookRecipe([
      { id: "dddddddd-0000-0000-0000-000000000001", after: 200 },
      { id: "dddddddd-0000-0000-0000-000000000002", after: 0 },
    ]);
    await db.query("select undo_cook($1)", [logId]);
    expect(await qty("dddddddd-0000-0000-0000-000000000001")).toBe("500");
    expect(await qty("dddddddd-0000-0000-0000-000000000002")).toBe("3");
    const row = (await db.query<{ name: string; unit: string }>("select name, unit from pantry_items where id = 'dddddddd-0000-0000-0000-000000000002'")).rows[0];
    expect(row).toEqual({ name: "Tomatoes", unit: "pieces" });
    expect((await db.query<{ undone_at: string | null }>("select undone_at from cooked_log where id = $1", [logId])).rows[0]?.undone_at).not.toBeNull();
  });

  it("adds to what is there now instead of overwriting it", async () => {
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000003", "Oats", 500);
    const logId = await cookRecipe([{ id: "dddddddd-0000-0000-0000-000000000003", after: 300 }]);
    await db.exec("update pantry_items set quantity = quantity + 1000 where id = 'dddddddd-0000-0000-0000-000000000003'"); // restocked
    await db.query("select undo_cook($1)", [logId]);
    expect(await qty("dddddddd-0000-0000-0000-000000000003")).toBe("1500");
  });

  it("brings an item back to no place if its place was deleted meanwhile", async () => {
    await as(ALICE);
    await db.exec("insert into pantry_locations (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Shelf')");
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000004", "Honey", 300, "g", "eeeeeeee-0000-0000-0000-000000000001");
    const logId = await cookRecipe([{ id: "dddddddd-0000-0000-0000-000000000004", after: 0 }]);
    await db.exec("delete from pantry_locations where id = 'eeeeeeee-0000-0000-0000-000000000001'");
    await db.query("select undo_cook($1)", [logId]);
    expect((await db.query<{ location_id: string | null; quantity: string }>("select location_id, quantity from pantry_items where id = 'dddddddd-0000-0000-0000-000000000004'")).rows[0]).toEqual({
      location_id: null,
      quantity: "300",
    });
  });

  it("works only once", async () => {
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000005", "Salt", 100);
    const logId = await cookRecipe([{ id: "dddddddd-0000-0000-0000-000000000005", after: 90 }]);
    await db.query("select undo_cook($1)", [logId]);
    await expect(db.query("select undo_cook($1)", [logId])).rejects.toThrow(/Already undone/);
    expect(await qty("dddddddd-0000-0000-0000-000000000005")).toBe("100");
  });

  it("is closed after ten minutes", async () => {
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000006", "Pepper", 100);
    const logId = await cookRecipe([{ id: "dddddddd-0000-0000-0000-000000000006", after: 90 }]);
    await db.exec("RESET ROLE");
    await db.query("update cooked_log set cooked_at = now() - interval '11 minutes' where id = $1", [logId]);
    await as(ALICE);
    await expect(db.query("select undo_cook($1)", [logId])).rejects.toThrow(/Too late/);
    expect(await qty("dddddddd-0000-0000-0000-000000000006")).toBe("90");
  });

  it("cannot undo someone else's meal", async () => {
    await addItem(ALICE, "dddddddd-0000-0000-0000-000000000007", "Cumin", 100);
    const logId = await cookRecipe([{ id: "dddddddd-0000-0000-0000-000000000007", after: 90 }]);
    await as(BOB);
    await expect(db.query("select undo_cook($1)", [logId])).rejects.toThrow(/not in the log/);
  });
});

describe("0009_kitchen_scene.sql", () => {
  it("can be run again without error", async () => {
    await db.exec("RESET ROLE");
    await db.exec(sql("0009_kitchen_scene.sql"));
  });

  it("keeps each layout private to its owner", async () => {
    await as(ALICE);
    await db.query("insert into kitchen_layouts (layout) values ($1::jsonb)", ['{"version":2}']);
    await as(BOB);
    expect((await db.query("select * from kitchen_layouts")).rows).toHaveLength(0);
    await expect(db.query("insert into kitchen_layouts (user_id, layout) values ($1, '{}'::jsonb)", [ALICE])).rejects.toThrow();
    await as(ALICE);
    await expect(db.query("insert into kitchen_layouts (layout) values ('{}'::jsonb)")).rejects.toThrow(); // one per user
  });

  it("stores an icon and a shelf on items, and rejects nonsense", async () => {
    await as(ALICE);
    await db.query("insert into pantry_items (id, name, icon, shelf) values ('ffffffff-0000-0000-0000-000000000001', 'Milk', 'milk', 2)");
    await expect(db.query("insert into pantry_items (name, shelf) values ('Bad', 99)")).rejects.toThrow();
    await expect(db.query("insert into pantry_items (name, icon) values ('Bad', '')")).rejects.toThrow();
  });

  it("brings an undone item back with its icon and shelf", async () => {
    await as(ALICE);
    await db.query("insert into pantry_items (id, name, quantity, unit, icon, shelf) values ('ffffffff-0000-0000-0000-000000000002', 'Jam', 1, 'pieces', 'jar', 1)");
    const logId = await cookRecipe([{ id: "ffffffff-0000-0000-0000-000000000002", after: 0 }]);
    await db.query("select undo_cook($1)", [logId]);
    const row = (await db.query<{ icon: string; shelf: number }>("select icon, shelf from pantry_items where id = 'ffffffff-0000-0000-0000-000000000002'")).rows[0];
    expect(row).toEqual({ icon: "jar", shelf: 1 });
  });
});

describe("0010_categories_places.sql", () => {
  it("can be run again without error", async () => {
    await db.exec("RESET ROLE");
    await db.exec(sql("0010_categories_places.sql"));
    await db.exec(sql("0010_categories_places.sql"));
  });

  it("sets accepted categories on places with the default names, and leaves others empty", async () => {
    await db.exec("RESET ROLE");
    await db.exec(`
      insert into pantry_locations (id, user_id, name, kind) values
        ('cccccccc-0000-0000-0000-000000000001', '${ALICE}', 'Meat and fish', 'shelf'),
        ('cccccccc-0000-0000-0000-000000000002', '${ALICE}', 'Top drawer', 'drawer');
    `);
    await db.exec(sql("0010_categories_places.sql"));
    const rows = (await db.query<{ name: string; accepts: string[] }>("select name, accepts from pantry_locations where id::text like 'cccccccc%' order by name")).rows;
    expect(rows).toEqual([
      { name: "Meat and fish", accepts: ["meat", "poultry", "fish"] },
      { name: "Top drawer", accepts: [] },
    ]);
  });

  it("converts produce, meat and egg categories by keyword and moves nothing", async () => {
    await db.exec("RESET ROLE");
    const rows: [string, string, string][] = [
      ["Tomatoes", "produce", "vegetables"],
      ["Äpfel", "produce", "fruit"],
      ["Mystery plant", "produce", "other"],
      ["Chicken breast", "meat", "poultry"],
      ["Hähnchenbrustfilet", "meat", "poultry"],
      ["Mixed minced meat", "meat", "meat"],
      ["Eggs", "dairy", "eggs"],
      ["Milk", "dairy", "dairy"],
      ["Chocolate", "snacks", "snacks and sweets"],
    ];
    for (const [i, [name, category]] of rows.entries()) {
      await db.query("insert into pantry_items (id, user_id, name, category) values ($1, $2, $3, $4)", [`eeeeeeee-0000-0000-0000-00000000000${i}`, ALICE, name, category]);
    }
    await db.exec(sql("0010_categories_places.sql"));
    const got = (await db.query<{ name: string; category: string }>("select name, category from pantry_items where id::text like 'eeeeeeee%'")).rows;
    for (const [name, , want] of rows) expect(got.find((g) => g.name === name)?.category).toBe(want);
  });

  it("converts dictionary entries the same way", async () => {
    await db.exec("RESET ROLE");
    await db.exec(`insert into product_aliases (user_id, raw_text, product_name, category) values
      ('${ALICE}', 'GURKE', 'Cucumber', 'produce'), ('${ALICE}', 'PUTENBRUST', 'Turkey breast', 'meat')`);
    await db.exec(sql("0010_categories_places.sql"));
    const got = (await db.query<{ product_name: string; category: string }>("select product_name, category from product_aliases where raw_text in ('GURKE','PUTENBRUST')")).rows;
    expect(got.find((g) => g.product_name === "Cucumber")?.category).toBe("vegetables");
    expect(got.find((g) => g.product_name === "Turkey breast")?.category).toBe("poultry");
  });

  it("keeps category names private to their owner", async () => {
    await as(ALICE);
    await db.query("insert into pantry_categories (key, label) values ('baby food', 'Baby food')");
    await as(BOB);
    expect((await db.query("select * from pantry_categories")).rows).toHaveLength(0);
    await expect(db.query("insert into pantry_categories (user_id, key, label) values ($1, 'x', 'X')", [ALICE])).rejects.toThrow();
    await as(ALICE);
    await expect(db.query("insert into pantry_categories (key, label) values ('Bad Key!', 'x')")).rejects.toThrow();
    await expect(db.query("insert into pantry_categories (key, label) values ('baby food', 'Again')")).rejects.toThrow();
  });
});

describe("0011_ai_chat_shopping.sql", () => {
  it("can be run again without error", async () => {
    await db.exec("RESET ROLE");
    await db.exec(sql("0011_ai_chat_shopping.sql"));
    await db.exec(sql("0011_ai_chat_shopping.sql"));
  });

  it("adds the chat switch (off) and counter (0) to the settings", async () => {
    await db.exec("RESET ROLE");
    await db.exec(`insert into pantry_settings (user_id) values ('${ALICE}') on conflict do nothing`);
    const row = (await db.query<{ ai_chat: boolean; ai_chat_requests: number }>(`select ai_chat, ai_chat_requests from pantry_settings where user_id = '${ALICE}'`)).rows[0];
    expect(row).toEqual({ ai_chat: false, ai_chat_requests: 0 });
    await expect(db.query(`update pantry_settings set ai_chat_requests = -1 where user_id = '${ALICE}'`)).rejects.toThrow();
  });

  it("keeps the shopping list private to its owner and checks the values", async () => {
    await as(ALICE);
    await db.query("insert into shopping_list (name, quantity, unit) values ('Milk', 1, 'l'), ('Salt', null, null)");
    await as(BOB);
    expect((await db.query("select * from shopping_list")).rows).toHaveLength(0);
    await expect(db.query("insert into shopping_list (user_id, name) values ($1, 'x')", [ALICE])).rejects.toThrow();
    await as(ALICE);
    expect((await db.query("select * from shopping_list")).rows).toHaveLength(2);
    await expect(db.query("insert into shopping_list (name, quantity, unit) values ('Bad', 0, 'g')")).rejects.toThrow();
    await expect(db.query("insert into shopping_list (name, quantity, unit) values ('Bad', 1, 'cups')")).rejects.toThrow();
    await expect(db.query("insert into shopping_list (name) values ('')")).rejects.toThrow();
  });
});

describe("0012_nutrition_macros.sql", () => {
  it("can be run again without error", async () => {
    await db.exec("RESET ROLE");
    await db.exec(sql("0012_nutrition_macros.sql"));
    await db.exec(sql("0012_nutrition_macros.sql"));
  });

  it("leaves one cook_recipe (the old seven-argument version is gone) and the old call still works", async () => {
    await db.exec("RESET ROLE");
    const n = (await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'cook_recipe'")).rows[0]?.n;
    expect(n).toBe(1);
    await as(ALICE);
    const id = await cookRecipe([]);
    const log = (await db.query<{ carbs_g: string | null; fat_g: string | null; portions: string | null }>("select carbs_g, fat_g, portions from cooked_log where id = $1", [id])).rows[0];
    expect(log).toEqual({ carbs_g: null, fat_g: null, portions: null });
  });

  it("logs carbs, fat and the portions eaten", async () => {
    await as(ALICE);
    const res = await db.query<{ cook_recipe: string }>(
      "select cook_recipe(null, 'Pasta', 4, 600, 22, 0, '[]'::jsonb, p_carbs_g => 90, p_fat_g => 14, p_portions => 1)",
    );
    const log = (await db.query("select kcal, protein_g, carbs_g, fat_g, portions from cooked_log where id = $1", [res.rows[0]?.cook_recipe])).rows[0];
    expect(log).toEqual({ kcal: "600", protein_g: "22", carbs_g: "90", fat_g: "14", portions: "1" });
  });

  it("checks the new values and keeps nutrition rows private", async () => {
    await as(ALICE);
    await db.query("insert into ingredient_nutrition (name, basis, kcal, protein_g, carbs_g, fat_g) values ('Oats', '100g', 372, 13, 60, 7)");
    await expect(db.query("insert into ingredient_nutrition (name, basis, kcal, protein_g, carbs_g) values ('Bad', '100g', 1, 1, -1)")).rejects.toThrow();
    await expect(db.query("select cook_recipe(null, 'x', 1, 1, 1, 0, '[]'::jsonb, p_portions => 0)")).rejects.toThrow();
    await as(BOB);
    expect((await db.query("select * from ingredient_nutrition where name = 'Oats'")).rows).toHaveLength(0);
  });
});
