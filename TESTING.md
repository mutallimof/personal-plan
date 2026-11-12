# Testing checklist

Do `MANUAL_STEPS.md` step 1 first (the two SQL files), then `npm run dev` and sign in. Tick each line.

## Automated
- [ ] `npx tsc --noEmit`, `npm run build` and `npm test` all pass (about 800 tests: progress rules, workout saving, receipt parsing, categories and places, icons, kitchen layout, the cooking chat, migrations on in-memory Postgres, PWA files). One test opens headless Edge for the kitchen overlap check (skipped when Edge is missing); `npx tsx scripts/kitchen-shots/layout-check.ts` runs it alone and prints every view.

## Workout logging
- [ ] Plan page: each session card has **Start workout**; the green **Next** card at the top has **Start**.
- [ ] Start a workout. Every exercise shows its planned sets, reps and weight pre-filled. The counter (e.g. 0/13) goes up as you tick sets.
- [ ] Change reps and weight on one set; tick it. Reload the page: your entries are still there (unfinished workouts resume).
- [ ] Finish with at least one ticked set. You land on the plan; in Supabase **Table Editor** `workout_logs` has a row and `workout_sets` has one row per set.
- [ ] Do another workout where every set of one exercise is done at a **heavier weight than planned**. On finish, "Update plan weight?" appears. **Update** changes the weight on the session page; **Keep plan** does not.
- [ ] **Discard** leaves without saving anything.

## Progress
- [ ] Open an exercise you have logged: a **Progress** chart shows weight (green) and reps (dashed).
- [ ] Log the same exercise in two workouts, hitting the top of the rep range on every set at the same weight. A **Go up** marker appears on the exercise page and on its row in the session page. Miss a rep in the latest one: it disappears.

## Library
- [ ] Library on desktop: tap a muscle on the body diagram (side panel); the list filters and the count changes. Tap it again, or the chip, to clear.
- [ ] Library on phone: **Body** chip opens the diagram; tap a muscle; chip shows the muscle with an x.
- [ ] Exercise page: diagram highlights primary (solid green) and secondary (light green) muscles; a neck exercise shows no highlights; **Variations** are grouped by equipment and open their page; **Add to a session** adds it with the sets/reps/weight you chose.
- [ ] Open an exercise from a session row (tap its name). **Swap to this variation** appears on a variation's page and swaps it.

## Session page
- [ ] Drag the handle (left of the name) to reorder; reload to confirm the order stuck. Keyboard: focus the handle, Space, arrow keys, Space.
- [ ] **Duplicate** (copy icon) creates "<name> copy" with the same exercises and weights.
- [ ] "N exercises · ~X min" shows under the name.

## Plan home
- [ ] After finishing session A, the **Next** card shows the session after it in your plan order. After the last one it wraps to the first.

## Profile
- [ ] Profile tab (bottom bar on phone, sidebar on desktop). Edit height, weight, goal, sessions per week; **Save**; reload to confirm. A bad value (height 50) shows a message and does not save.
- [ ] Add a weigh-in (date + kg). It appears in the list and the chart (chart needs two entries). Delete one with the bin. Adding the newest weigh-in also updates your profile weight.
- [ ] On phone, **Sign out** is at the bottom of the Profile page.

## Phone / PWA (needs the deployed https build, see `DEPLOY.md`)
- [ ] The browser offers **Install app** / **Add to Home Screen**; the icon is a green tile with a dark sprout; it opens full screen.
- [ ] Open the Plan page once online. Turn on airplane mode, reopen the app: the plan still shows (last loaded copy). Other pages show "Could not load this".
- [ ] At 375 px wide, no page scrolls sideways; the bottom bar has Gym, Languages, Pantry, Profile.
- [ ] Keyboard: Tab through the Plan page; every control shows a dark green focus ring.

## Exercise pictures
- [ ] Open Gym > Library > any imported exercise (e.g. Incline dumbbell press): a card with the movement shows above the steps and flips start/end every second.
- [ ] Tap the pause button: it stops and the icon becomes play. Tap again: it resumes.
- [ ] OS setting "reduce motion" on, reload: both pictures sit side by side, no button, no fading.
- [ ] Open an exercise you created yourself: no card, no gap.
- [ ] Network tab set to Offline, reload the page: no card and no broken-image icon.

## Pantry (run migrations 0004 to 0008 first)
- [ ] **Items:** add milk (1 l) to the fridge; add it again: one row, quantity 2. Pick a date in the past: red expired marker; within 3 days: warning. Edit, move and delete work.
- [ ] **Dictionary:** starter products are listed once. Add an alias, export JSON, delete it, import the file: it is back. A broken file is rejected with a message and changes nothing.
- [ ] **Receipt, paste:** paste text with a few product lines; review screen lists unknown lines first. Confirm, skip and edit a line; Save adds items to the chosen place and the dictionary learns the confirmed names (import the same text again: they match).
- [ ] **Receipt, PDF and HTML:** pick a digital receipt file; text appears and parses like pasted text.
- [ ] **Receipt, photo:** pick a clear photo of a receipt (first use needs internet). Progress shows; low-confidence lines are marked. Nothing is uploaded: the Network tab shows only the engine download.
- [ ] **AI check:** with `AI_API_KEY` set, turn it on; unmatched lines get suggestions you must accept. Turn off or remove the key: import still works.
- [ ] **Kitchen:** map shows fridge, freezer, shelves with item emoji. Tap a zone: its items list. Tap the fridge: it zooms to its drawers; Back zooms out. Drag an emoji to another zone: the item moves. **Edit layout:** drag a zone, drag the green corner, type exact values, add and delete a zone. Export, change, import: layout restored.
- [ ] Phone: the four tabs fit at 375 px; the map is usable by touch.
- [ ] `npm test` runs 471 tests including parser, matching, review screen, kitchen geometry, map dragging, the photo helper, cooking logic and the migration 0008 SQL on an in-memory Postgres.

## Receipt photo helper (Pantry > Receipt > Photo of a receipt)
- [ ] On a phone (deployed https build): **Take photo** opens the camera with a green frame and the text "Fit the whole receipt, hold the phone straight above it". Take a picture of a receipt on a table.
- [ ] On a computer: **Choose a photo** works, and dropping an image on the dashed box works.
- [ ] Take a dark photo (cover the light): "Too dark, try more light" with **Retake** and **Use anyway**. Same for a blurry one ("Too blurry...") and a tiny one ("Too small...").
- [ ] A good photo goes straight to the preview: original on the left, cleaned-up on the right (cropped to the paper, text level). **Read receipt** reads the cleaned-up one; with **Use original** on it reads the original; **Black and white** changes the right-hand picture.
- [ ] If the camera is refused, the phone's own camera app opens instead.
- [ ] `npm run ocr:eval` on your own photos prints "original" and "helper" for each and a final comparison line.

## Cook (run migration 0008 first)
- [ ] Cook > Recipes > **New**: name, servings, ingredients (names suggest your pantry items), steps. **Save**. Search finds it by title and by ingredient. **Edit** and **Delete** work.
- [ ] Cook > Nutrition lists starter foods (eggs, butter, rice, ...). Tap one, change kcal, save; add a food of your own; delete one.
- [ ] Add pantry items for a recipe (Items tab). Cook > Can cook shows the recipe, with rough kcal and protein per serving and "approx., N ingredients missing" when an ingredient has no nutrition row. A recipe missing one or two ingredients shows what is missing; one missing three is not listed.
- [ ] A recipe that uses an item expiring in the next days is listed above an otherwise equal one ("Uses food that expires soon").
- [ ] **Cook this**: each ingredient shows the amount to remove. Change one, skip one, change servings (amounts rescale). **Cook**: the Items tab shows the lowered quantities; used-up items are gone. A message offers **Undo**; tap it: the amounts are back. The *Cooked recently* list shows the meal and today's totals, and **Undo** there disappears after 10 minutes.
- [ ] With no recipes, Cook shows "No recipes yet." with **Add recipe**, **Import recipes (JSON)** and, while the AI chat is off, a link to Settings. Import a file like `[{"title":"Soup","servings":2,"ingredients":[{"name":"Carrots","quantity":500,"unit":"g"}],"steps":["Boil"]}]`.
- [ ] Cook > **Ask AI** while the chat is off says so and links to Settings > AI. Turn **AI cooking chat** on there (the line under it says what is sent). With `AI_API_KEY` set, ask "what can I cook with chicken and potatoes in 30 minutes": 1 to 3 recipe cards appear with time, kcal and protein per serving from your nutrition table (not from the AI), what is missing, and **Cook this**, **Save recipe**, **Add missing to list**. Nothing is saved until you press a button. Words appear as they arrive, with three dots before the first one. **Cook this** opens the usual confirmation; nothing leaves the pantry before you press Cook. The request counter in Settings goes up by one per answered message. With a wrong key or when rate-limited, a short message appears and the page keeps working.
- [ ] Stock Lachsfilet (500 g), Dill Bund (1 pack), Zitronen (3 pieces) and Schlagsahne (200 ml). A recipe or AI card that asks for 2 pieces of Lachsfilet, Dill, 2 Zitrone and Sahne lists none of them as missing; Thymian is listed.
- [ ] Ask "save that recipe and add the missing things to my shopping list": the recipe appears under Recipes and the things under Cook > **Shopping**, where you can tick, remove and **Clear bought**.

## Receipts, categories and places (run migrations 0010 and 0011 first)
- [ ] Paste a Kaufland receipt: two-line items show one product with the right amount; sizes in names ("1L", "250g") become unit and quantity; abbreviations like `K.H-Milch` and `Rhönsp.Miwa Natur.` show known products; lines the app cannot read are "Unknown" and come first.
- [ ] A discount line does not appear as its own product; the price of the product above changes. Deposit, bag and payment lines are under **Ignored lines** (collapsed); **Restore** brings one back. Toilet paper is "Not food" and skipped; **Track anyway** includes it.
- [ ] In the review, change a category: the place changes to one that accepts it. The place dropdown only lists places that accept the category (or all, when none does).
- [ ] Settings > Categories: add "Baby food", rename one; items keep their category. All items shows **Needs a category** for old items that could not be converted.
- [ ] Settings > Kitchen layout: each place has category chips (accepts); toggling one and saving changes where the next receipt puts things.
- [ ] All items > **Organize** lists suggested moves (for example fish in the vegetable drawer); Apply moves only what you leave ticked.
- [ ] Icons: Butter, Milk, Cream, Yogurt, Cheese and Eggs all look different; Sauce shows a bottle, Pork a ham, Bananas a banana.

## Kitchen (run migration 0009 first)
- [ ] Pantry opens on the kitchen picture with Search, Add receipt, Add item, Cook, All items and a gear icon. No tab bar.
- [ ] Tap the fridge: the door swings open, the view zooms in, labelled compartments show products as pictures with quantity badges. The arrow, Escape, a tap on the wall and the browser back button each close it.
- [ ] Tap a product: the item sheet opens. Change quantity, expiry, place; change the icon through *Change icon* (search "milk", "kase"); **Automatic** goes back.
- [ ] Drag a product to another shelf or compartment: it moves. Drop it outside the cabinet: a place chooser appears.
- [ ] An empty shelf shows "Empty" and a + that opens Add item with that place; they never touch. Every compartment has its name in a strip above the products, products stand on the shelf line and the quantity badge is complete. The open fridge door leaves no sliver over the shelves.
- [ ] Search for an item: results list its place; choosing one zooms to the cabinet and the item pulses. An item in a place that is not on the map says "not on the map".
- [ ] On a phone, drag the scene sideways; it snaps to Shelves / Cooker / Fridge. Tap targets are comfortable.
- [ ] Turn on "reduce motion" in your system: opening is a short fade.
- [ ] Settings > Kitchen layout: change a door type, add a spot, **Save**; Export, then Import the file again. A broken file shows a short error and changes nothing.
- [ ] Old links `/pantry/receipt` and `/pantry/dictionary` land on the sheets.

## What I was unsure about or did not finish
- **Nothing was run against your real Supabase.** I tested every screen in a browser at 375 px and 1280 px with a fake session and a mocked API (flows: finish workout and update plan weight, tap-to-filter, add-to-session). Real inserts, row-level security and the two SQL files are untested until you run them.
- **Google sign-in, the AI chat and onboarding "Generate my plan"** were not touched or tested.
- **"Go up" rule.** I added one condition beyond the plan: both sessions must have the same top weight (otherwise a weight you already raised would keep nagging). Say if you want it looser.
- **Rep prefill.** A new workout pre-fills reps with the *low* end of the range (8 for 8-12), so ticking a set without editing never counts as hitting the top.
- **Duration estimate** is a formula (40 s work + 90 s rest per set, 1 min per exercise), not learned from your logs.
- **Offline** is deliberately small: the app shell and the last loaded plan. Logging a workout offline is not supported; an unfinished workout is kept on the phone and can be finished once back online.
- **Auth check changed** so the app opens offline: the route guard now reads the stored session instead of asking the server. Data stays protected by row-level security.
- **Colour change for contrast:** text on green is now near-black (white on #22C55E fails the contrast rule), and green text uses a darker green. This is visible everywhere there is a green button.
- **Muscle diagram:** the package has no lat or side-delt region, so lats use "upper back" and side delts light both deltoids; tapping "upper back" matches lat exercises too.
- **Not done / out of scope:** Phase 3 (Languages, Pantry). Week/month views were only given error states and larger tap targets. The `drizzle/` folder and `setup.sql` were left as they were; new SQL lives in `migrations/`.
- `PLAN.md` is still untracked (it was never committed); I left it that way.
- **Pantry, not verified in a real browser or against a real Supabase project** (it needs your login): everything above is covered by unit and jsdom tests only.
- **Pantry, uncertain:** learned aliases are store-specific when a store is detected; no store parser exists yet (generic German only); dragging and resizing zones on a phone is coarse (the numeric fields are the fallback); pantry places can only be added through kitchen zones; the AI usage counter counts lines once the provider has answered; photo OCR downloads its engine from a CDN on first use; moving an item by drag merges equal items but changing the place in the edit dialog does not.
- **Not started:** Phase G ("What can I cook").
- **Photo helper, uncertain:** the quality limits (`photo-config.ts`) and the whole helper were tested on invented images only; nothing was run on real phone photos. The in-app camera (getUserMedia) could not be tried here. Crop assumes the paper is brighter than its surroundings; a white receipt on a white table is not cropped, and a curled or folded receipt is not straightened.
- **Cook, uncertain:** the SQL functions were tested on PGlite (in-memory Postgres), not on Supabase itself. Day totals add up whole cooked servings (not what you ate). Recipe and nutrition matching is by name (case, accents and plural *s* ignored), so "Basmati rice" does not match "Rice". No recipe is preloaded, and the starter nutrition table has 42 foods only. Editing a recipe saves it in several steps (new ingredients first), not one transaction. Changing servings in *Cook this* resets amounts you edited.
- **Kitchen, uncertain:** the artwork was checked in headless Edge screenshots with invented data only, not on a real phone and not with your items. Drag and drop uses pointer events and was tested with hand-written events, not on a touch screen. The conversion of the old map and the default places were tested on invented data, not on your database. Receipts still choose the first place of a kind (for example the whole fridge, which shows as the "Other" row), not a compartment. The screenshot script is not part of `npm test`.
- **Build-fixes, uncertain:** only seven Kaufland abbreviations are seeded; `KLC Papr. edels.`, `bev.Flüssigs.NFB` and `KBB Lachsfil` stay Unknown on purpose (not sure enough). The defaults 250 g for Weih.Butter and 500 g for chicken breast fillet and unknown meat/fish are assumptions. Freezer compartments other than the first have no accepts by default, and categories can be renamed but not deleted. The yogurt picture (a bowl) can look a little like a steak. The Cook tab bar with five tabs and the chat were tested in jsdom only, not looked at in a browser at 375 px; the chat was never run against a real model or provider (tool calling is tested with a fake). The server function reads your pantry with your own session (row-level security applies); the request counter counts answered requests, and there is no daily cap beyond the provider's own rate limit.
