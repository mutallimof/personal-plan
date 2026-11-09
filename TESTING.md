# Testing checklist

Do `MANUAL_STEPS.md` step 1 first (the two SQL files), then `npm run dev` and sign in. Tick each line.

## Automated
- [ ] `npx tsc --noEmit`, `npm run build` and `npm test` all pass (42 tests: progress rules, workout saving, mappings, profile form, plan cache, PWA files).

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
- [ ] The browser offers **Install app** / **Add to Home Screen**; the icon is a green dumbbell tile; it opens full screen.
- [ ] Open the Plan page once online. Turn on airplane mode, reopen the app: the plan still shows (last loaded copy). Other pages show "Could not load this".
- [ ] At 375 px wide, no page scrolls sideways; the bottom bar has Gym, Languages, Pantry, Profile.
- [ ] Keyboard: Tab through the Plan page; every control shows a dark green focus ring.

## Exercise pictures
- [ ] Open Gym > Library > any imported exercise (e.g. Incline dumbbell press): a card with the movement shows above the steps and flips start/end every second.
- [ ] Tap the pause button: it stops and the icon becomes play. Tap again: it resumes.
- [ ] OS setting "reduce motion" on, reload: both pictures sit side by side, no button, no fading.
- [ ] Open an exercise you created yourself: no card, no gap.
- [ ] Network tab set to Offline, reload the page: no card and no broken-image icon.

## Pantry (run migrations 0004 to 0007 first)
- [ ] **Items:** add milk (1 l) to the fridge; add it again: one row, quantity 2. Pick a date in the past: red expired marker; within 3 days: warning. Edit, move and delete work.
- [ ] **Dictionary:** starter products are listed once. Add an alias, export JSON, delete it, import the file: it is back. A broken file is rejected with a message and changes nothing.
- [ ] **Receipt, paste:** paste text with a few product lines; review screen lists unknown lines first. Confirm, skip and edit a line; Save adds items to the chosen place and the dictionary learns the confirmed names (import the same text again: they match).
- [ ] **Receipt, PDF and HTML:** pick a digital receipt file; text appears and parses like pasted text.
- [ ] **Receipt, photo:** pick a clear photo of a receipt (first use needs internet). Progress shows; low-confidence lines are marked. Nothing is uploaded: the Network tab shows only the engine download.
- [ ] **AI check:** with `AI_API_KEY` set, turn it on; unmatched lines get suggestions you must accept. Turn off or remove the key: import still works.
- [ ] **Kitchen:** map shows fridge, freezer, shelves with item emoji. Tap a zone: its items list. Tap the fridge: it zooms to its drawers; Back zooms out. Drag an emoji to another zone: the item moves. **Edit layout:** drag a zone, drag the green corner, type exact values, add and delete a zone. Export, change, import: layout restored.
- [ ] Phone: the four tabs fit at 375 px; the map is usable by touch.
- [ ] `npm test` runs 308 tests including parser, matching, review screen, kitchen geometry and map dragging.

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
