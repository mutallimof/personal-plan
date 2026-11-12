// Invented data for the design screenshots (see shoot.mjs). Nothing here is real, and nothing is written anywhere.
import { readFileSync } from "node:fs";

const USER = "00000000-0000-4000-8000-000000000001";
const at = "2026-01-01T00:00:00Z";
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const user = { id: USER, aud: "authenticated", role: "authenticated", email: "demo@example.com", app_metadata: {}, user_metadata: {}, created_at: at };

const layout = JSON.parse(readFileSync(new URL("../../src/features/kitchen/default-layout.json", import.meta.url), "utf8"));

const PLACES = [
  ["Fridge", "fridge", null],
  ["Meat and fish", "drawer", "Fridge"],
  ["Dairy and eggs", "shelf", "Fridge"],
  ["Vegetable drawer", "shelf", "Fridge"],
  ["Fruit drawer", "shelf", "Fridge"],
  ["Drinks and sauces", "shelf", "Fridge"],
  ["Freezer", "freezer", null],
  ["Frozen vegetables and fruit", "shelf", "Freezer"],
  ["Frozen meat and fish", "drawer", "Freezer"],
  ["Frozen ready meals", "shelf", "Freezer"],
  ["Dry-goods shelf", "shelf", null],
  ["Spice shelf", "shelf", null],
  ["Glass cabinet", "cupboard", null],
  ["Base cabinet", "cupboard", null],
  ["Under the sink", "cupboard", null],
  ["Kitchen drawers", "drawer", null],
];
const pantry_locations = PLACES.map(([name, kind, parent], position) => ({ id: name, user_id: USER, name, kind, parent_id: parent, position, accepts: [], created_at: at }));

const ITEMS = [
  ["Meat and fish", "Salmon", 300, "g", "fish", { expires_on: day(1) }],
  ["Meat and fish", "Chicken breast", 500, "g", "meat"],
  ["Dairy and eggs", "Yogurt", 3, "pieces", "dairy"],
  ["Dairy and eggs", "Eggs", 6, "pieces", "dairy"],
  ["Dairy and eggs", "Butter", 1, "pack", "dairy", { expires_on: day(-1) }],
  ["Dairy and eggs", "Milk", 1, "l", "dairy"],
  ["Vegetable drawer", "Carrots", 500, "g", "vegetables"],
  ["Vegetable drawer", "Tomatoes", 4, "pieces", "vegetables"],
  ["Vegetable drawer", "Cucumber", 1, "pieces", "vegetables"],
  ["Fruit drawer", "Apples", 5, "pieces", "fruit"],
  ["Fruit drawer", "Lemon", 2, "pieces", "fruit"],
  ["Drinks and sauces", "Ketchup", 1, "pack", "sauces"],
  ["Drinks and sauces", "Orange juice", 1, "l", "drinks"],
  ["Frozen ready meals", "Pizza", 2, "pieces", "frozen"],
  ["Frozen vegetables and fruit", "Peas", 450, "g", "frozen"],
  ["Dry-goods shelf", "Basmati rice", 1, "kg", "grains"],
  ["Dry-goods shelf", "Spaghetti", 500, "g", "grains"],
  ["Dry-goods shelf", "Black beans", 2, "pack", "canned"],
  ["Dry-goods shelf", "Oats", 500, "g", "grains"],
  ["Dry-goods shelf", "Honey", 1, "pieces", "sweets"],
  ["Dry-goods shelf", "Coffee", 250, "g", "drinks"],
  ["Spice shelf", "Salt", 1, "pack", "spices"],
  ["Spice shelf", "Cinnamon", 1, "pack", "spices"],
  ["Spice shelf", "Basil", 1, "pack", "spices"],
  ["Glass cabinet", "Tea", 1, "pack", "drinks"],
  ["Glass cabinet", "Chocolate", 2, "pieces", "sweets"],
  ["Glass cabinet", "Cookies", 1, "pack", "sweets"],
  ["Base cabinet", "Dish soap", 1, "pieces", "household"],
  ["Kitchen drawers", "Batteries", 1, "pack", "household"],
];
const pantry_items = ITEMS.map(([location_id, name, quantity, unit, category, extra = {}], i) => ({
  id: `item-${i}`,
  user_id: USER,
  name,
  quantity,
  unit,
  category,
  location_id,
  added_at: at,
  expires_on: null,
  note: null,
  icon: null,
  shelf: null,
  ...extra,
}));

const RECIPES = [
  ["Salmon, rice and peas", 2, [["Salmon", 300, "g"], ["Basmati rice", 150, "g"], ["Peas", 150, "g"], ["Lemon", 1, "pieces"]]],
  ["Tomato spaghetti", 2, [["Spaghetti", 200, "g"], ["Tomatoes", 4, "pieces"], ["Basil", 1, "pack"], ["Parmesan", 40, "g"]]],
  ["Chicken with carrots", 3, [["Chicken breast", 450, "g"], ["Carrots", 300, "g"], ["Basmati rice", 200, "g"]]],
  ["Oat pancakes", 2, [["Oats", 120, "g"], ["Eggs", 2, "pieces"], ["Milk", 200, "ml"], ["Banana", 1, "pieces"], ["Honey", 1, "pieces"]]],
];
const recipes = RECIPES.map(([title, servings], i) => ({ id: `recipe-${i}`, user_id: USER, title, servings, steps: "Cook everything.", source: "manual", created_at: at }));
const recipe_ingredients = RECIPES.flatMap(([, , list], r) =>
  list.map(([name, quantity, unit], position) => ({ id: `ing-${r}-${position}`, user_id: USER, recipe_id: `recipe-${r}`, name, quantity, unit, position, pantry_item_id: null })),
);

const FOODS = [
  ["Salmon", "100g", 208, 20, 0, 13],
  ["Basmati rice", "100g", 350, 8, 77, 1],
  ["Peas", "100g", 81, 5, 14, 0.4],
  ["Lemon", "piece", 17, 0.6, 5, 0.2],
  ["Spaghetti", "100g", 358, 12.5, 72, 1.5],
  ["Tomatoes", "piece", 22, 1, 4.8, 0.2],
  ["Chicken breast", "100g", 120, 22.5, 0, 2.6],
  ["Carrots", "100g", 41, 0.9, 9.6, 0.2],
  ["Oats", "100g", 370, 13.5, 59, 7],
  ["Eggs", "piece", 78, 6.3, 0.6, 5.3],
  ["Milk", "100ml", 47, 3.4, 4.9, 1.5],
  ["Honey", "100g", 304, 0.3, 82, 0],
];
const ingredient_nutrition = FOODS.map(([name, basis, kcal, protein_g, carbs_g, fat_g], i) => ({ id: `food-${i}`, user_id: USER, name, basis, kcal, protein_g, carbs_g, fat_g, source: "USDA FoodData Central" }));

const MEALS = [
  ["Oat pancakes", 3, 1, 520, 21, 74, 14],
  ["Chicken with carrots", 26, 1, 610, 48, 62, 9],
  ["Tomato spaghetti", 31, 1, 540, 19, 88, 8],
  ["Salmon, rice and peas", 50, 1, 640, 41, 66, 21],
  ["Oat pancakes", 74, 2, 1040, 42, 148, 28],
  ["Chicken with carrots", 98, 1, 610, 48, 62, 9],
  ["Tomato spaghetti", 124, 1.5, 810, 28, 132, 12],
  ["Salmon, rice and peas", 146, 1, 640, 41, 66, 21],
];
const cooked_log = MEALS.map(([title, hours, portions, kcal, protein_g, carbs_g, fat_g], i) => ({
  id: `meal-${i}`,
  user_id: USER,
  title,
  recipe_id: null,
  servings: 2,
  portions,
  kcal,
  protein_g,
  carbs_g,
  fat_g,
  kcal_missing: 0,
  removed: [],
  cooked_at: ago(hours),
  undone_at: null,
}));

const shopping_list = [
  ["Parmesan", 40, "g", false],
  ["Bananas", null, null, false],
  ["Olive oil", null, null, false],
  ["Greek yogurt", 2, "pieces", false],
  ["Oat milk", null, null, true],
  ["Garlic", null, null, true],
].map(([name, quantity, unit, done], i) => ({ id: `buy-${i}`, user_id: USER, name, quantity, unit, done, created_at: ago(40 - i) }));

const EXERCISES = [
  ["Bench press", "chest", "barbell"],
  ["Incline dumbbell press", "chest", "dumbbell"],
  ["Overhead press", "shoulders", "barbell"],
  ["Lateral raise", "shoulders", "dumbbell"],
  ["Triceps pushdown", "arms", "cable"],
  ["Pull-up", "back", "bodyweight"],
  ["Barbell row", "back", "barbell"],
  ["Face pull", "shoulders", "cable"],
  ["Biceps curl", "arms", "dumbbell"],
  ["Squat", "legs", "barbell"],
  ["Romanian deadlift", "legs", "barbell"],
  ["Leg press", "legs", "machine"],
  ["Calf raise", "legs", "machine"],
];
const exercises = EXERCISES.map(([name, muscle_group, equipment], i) => ({
  id: `ex-${i}`,
  name,
  slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
  family: name,
  muscle_group,
  equipment,
  primary_muscles: [],
  secondary_muscles: [],
  steps: [],
}));
const PLAN = [
  ["Push", [0, 1, 2, 3, 4]],
  ["Pull", [5, 6, 7, 8]],
  ["Legs", [9, 10, 11, 12]],
];
const sessions = PLAN.map(([name, list], position) => ({
  id: `session-${position}`,
  user_id: USER,
  name,
  position,
  created_at: at,
  items: list.map((e, p) => ({
    id: `se-${position}-${p}`,
    user_id: USER,
    session_id: `session-${position}`,
    exercise_id: `ex-${e}`,
    position: p,
    sets: 3,
    reps: "8-12",
    weight_kg: 20 + e * 2.5,
    weight_note: null,
    exercise: exercises[e],
  })),
}));

export const tables = {
  profiles: [{ id: USER, onboarded: true, height_cm: 180, weight_kg: 76, goal: "Wider shoulders", sessions_per_week: 4, experience: "Intermediate", created_at: at }],
  pantry_settings: [
    {
      user_id: USER,
      ai_check: false,
      ai_lines_sent: 0,
      ai_recipes: false,
      ai_recipe_requests: 0,
      ai_chat: true,
      ai_chat_requests: 12,
      aliases_seeded: true,
      aliases_seed_version: 999,
      layout_upgraded: true,
      kitchen_seeded: true,
      locations_seeded: true,
      nutrition_seeded: true,
    },
  ],
  kitchen_layouts: [{ user_id: USER, layout, updated_at: at }],
  kitchen_zones: [],
  pantry_locations,
  pantry_items,
  pantry_categories: [],
  product_aliases: [],
  recipes,
  recipe_ingredients,
  ingredient_nutrition,
  cooked_log,
  shopping_list,
  exercises,
  sessions,
  session_exercises: sessions.flatMap((s) => s.items),
  scheduled_sessions: [],
  workout_logs: [{ id: "log-0", user_id: USER, session_id: "session-0", session_name: "Push", started_at: ago(50), finished_at: ago(49), created_at: ago(49) }],
  workout_sets: [],
  body_weight_logs: [0, 1, 2, 3, 4].map((i) => ({ id: `bw-${i}`, user_id: USER, date: day(-28 + i * 7), weight_kg: 77.4 - i * 0.3, created_at: at })),
  chat_messages: [],
};

/** What the cooking chat "answers" in the chat screenshot: the same line format the server streams. */
export const chatStream =
  [
    { type: "text", delta: "You have salmon that expires tomorrow, so I would start there. " },
    {
      type: "done",
      requests: 13,
      reply: "You have salmon that expires tomorrow, so I would start there. Here is one idea that uses only what is in your kitchen.",
      cook: null,
      saved: [],
      cards: [
        {
          title: "Lemon salmon with rice and peas",
          servings: 2,
          minutes: 25,
          ingredients: [
            { name: "Salmon", quantity: 300, unit: "g" },
            { name: "Basmati rice", quantity: 150, unit: "g" },
            { name: "Peas", quantity: 150, unit: "g" },
            { name: "Lemon", quantity: 1, unit: "pieces" },
          ],
          steps: ["Cook the rice.", "Fry the salmon, 3 minutes a side.", "Warm the peas, squeeze the lemon over everything."],
        },
      ],
    },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n";
