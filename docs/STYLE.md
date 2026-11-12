# Lifeplan style

One direction: **Garden**. A warm sheet of paper, deep forest ink, and one living green. Things you can touch are
round and sit on white tiles; headings have character, everything else stays quiet. It should feel like a tidy kitchen
notebook, not a dashboard.

Live sheets: run `npm run dev` and open `/design` (dev only). Tokens live in `src/styles.css`.

## Principles

1. **One green.** `#22C55E` is for the main action on a screen, the active place in navigation, and "done / have it".
   Nothing else is green. Text in green uses `primary-ink` (the bright green fails contrast on paper).
2. **Paper, tiles, ink.** The page is `background` (paper). Content sits on `tile`s (white, hairline border, soft
   shadow). Text is `foreground` (ink) or `muted-foreground`. No other surfaces.
3. **Thumb first.** Every control is at least 44 px (`--tap`). Main actions are full width or sit at the bottom of the
   screen. Dialogs open as bottom sheets on phones. Navigation is a dock at the bottom.
4. **Few words.** Labels, not sentences. No helper text unless it prevents a mistake.
5. **Same on phone and desktop.** One column that widens; desktop gets a side rail instead of the dock, nothing else
   changes.

## Colour

Semantic names only; never a raw hex or a Tailwind palette colour (`amber-100`, `white`) in a component.

| Token | Use | Light | Dark |
| --- | --- | --- | --- |
| `background` | page (paper) | `oklch(0.972 0.008 100)` | `oklch(0.165 0.014 160)` |
| `foreground` | text (ink) | `oklch(0.21 0.03 160)` | `oklch(0.95 0.012 120)` |
| `card` | tiles, inputs | `oklch(1 0 0)` | `oklch(0.212 0.017 160)` |
| `popover` | dialogs, menus, toasts | `oklch(1 0 0)` | `oklch(0.24 0.018 160)` |
| `primary` | the main action, active nav | `#22C55E` | `oklch(0.76 0.19 150)` |
| `primary-foreground` | text on primary (ink, not white) | `oklch(0.2 0.04 160)` | `oklch(0.17 0.035 160)` |
| `primary-ink` | green text, icons, focus ring | `oklch(0.43 0.11 152)` | `oklch(0.81 0.17 150)` |
| `primary-soft` | selection, soft highlights | `oklch(0.92 0.075 152)` | `oklch(0.33 0.075 152)` |
| `accent` / `accent-foreground` | selected chip, "next" card | `oklch(0.94 0.05 152)` | `oklch(0.295 0.05 152)` |
| `secondary`, `muted` | tracks, quiet buttons, skeletons | `oklch(0.94 0.011 105)` | `oklch(0.262 0.018 160)` |
| `muted-foreground` | secondary text | `oklch(0.47 0.022 160)` | `oklch(0.73 0.02 150)` |
| `border` / `input` | hairlines / control outlines | `oklch(0.9 0.011 105)` / `0.85` | `oklch(0.3 0.018 160)` / `0.38` |
| `destructive` | delete, errors | `oklch(0.57 0.2 27)` | `oklch(0.7 0.17 25)` |
| `warning-soft` / `warning-ink` | expires soon, needs review | `oklch(0.94 0.07 88)` / `oklch(0.41 0.1 65)` | `oklch(0.33 0.06 80)` / `oklch(0.88 0.11 88)` |

Body text on paper and on tiles is above 7:1; muted text above 4.5:1; ink on the green above 7:1.

The kitchen illustration keeps its own palette (`src/features/kitchen/scene-theme.css`); only its highlight follows
`primary`.

## Type

| Role | Font | Size / weight | Class |
| --- | --- | --- | --- |
| Display (splash) | Bricolage Grotesque | 44-56 / 800, tracking -0.025em | `font-heading text-5xl font-extrabold` |
| Page title (`h1`) | Bricolage Grotesque | 28 / 700 | `text-[1.75rem] leading-tight` |
| Section title (`h2`) | Bricolage Grotesque | 20 / 600-700 | `text-xl font-semibold` |
| Card title (`h3`) | Bricolage Grotesque | 16-17 / 600 | `font-semibold` |
| Big number | Bricolage Grotesque | 28-32 / 700, tabular | `font-heading text-3xl font-bold tabular-nums` |
| Body | Figtree | 15-16 / 400 | `text-[15px]` or `text-base` |
| Secondary | Figtree | 14 / 400 | `text-sm text-muted-foreground` |
| Caption | Figtree | 12 / 500 | `text-xs` |
| Eyebrow | Figtree | 11 / 600, caps, tracking 0.08em | `eyebrow` |

`h1`-`h3` take the heading font automatically; use `font-heading` for numbers and titles that are not headings.
Inputs are 16 px on phones (no zoom on focus). Numbers that change or line up use `tabular-nums`.

## Space

4 px grid (Tailwind's scale). The steps in use:

| Step | px | Use |
| --- | --- | --- |
| `1` / `1.5` | 4 / 6 | icon to label, inside chips |
| `2` | 8 | between buttons in a row, between list tiles |
| `3` | 12 | between tiles in a group |
| `4` | 16 | page gutter on phones, tile padding |
| `5` / `6` | 20 / 24 | between sections; tile padding on desktop |
| `8` | 32 | between page regions |

Page: `max-w-5xl`, gutter 16 px (32 px from `sm`). Touch target: `--tap` = 44 px. Dock height: `--dock` = 72 px.

## Radius

`--radius` is 16 px in Garden. `rounded-lg` 14, `rounded-xl` 16 (inputs, selects), `rounded-2xl` 22 (tiles),
`rounded-3xl` 28 (dialogs, sheets), `rounded-full` (buttons, chips, switches, dock).

## Elevation

Shadows are tinted with the ink, never grey-black on paper.

| Class | Use |
| --- | --- |
| `shadow-card` | tiles, primary buttons |
| `shadow-pop` | menus, toasts, the dock |
| `shadow-float` | dialogs, sheets, the chat button |

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | press, hover |
| `--dur-base` | 200 ms | colour, selection, switch |
| `--dur-slow` | 360 ms | sheets, page pieces arriving |
| `ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | everything that enters |
| `ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | the logo leaves only |

Buttons shrink to 97% while pressed. Lists and tiles do not animate on every render. `prefers-reduced-motion` turns
all of it off.

## Components

- **Tile** (`tile`): the only container. Lists are one tile with `divide-y`; a row is at least 48 px.
- **Button**: pill. `default` (green, one per screen region), `outline` (white, second choice), `secondary` (quiet),
  `ghost` (tertiary, in rows), `destructive`. 44 px high; `lg` 52 px for the one action at the bottom of a form.
- **Input / Select**: 44 px, `rounded-xl`, white on paper; focus = green ring.
- **Segmented control** (`seg` + `seg-item`): the tabs of a section. The selected item is a white pill.
- **Chip**: pill, 44 px when it is a choice, 24 px when it is a status (`warning-soft`, `destructive/10`, `accent`).
- **Empty state**: dashed outline, one line, at most one button.
- **Dialog**: bottom sheet on phones (handle, 28 px top corners), centred card from `sm`.
- **Icons**: lucide, 20 px in navigation and buttons with a label next to them, 16 px inline, stroke 2 (2.4 when
  active in the dock). Food pictures are Twemoji.

## Logo

A sprout on a rounded tile: two leaves, the small one left and the tall one right, so it also reads as a tick.
Tile `#22C55E`, sprout `#10261C`. In the app the mark takes `primary` / `primary-foreground`, so it follows the theme.
Source: `src/components/Logo.tsx`; `public/favicon.svg` and the PNGs (`node scripts/make-icons.mjs`) use the same paths.
Clear space: a quarter of the tile on every side. Smallest size: 16 px.

## Themes

Same layout and components; only tokens change (`data-theme` on `<html>`, chosen in **Settings > Appearance**, stored
on the device).

| Theme | Feeling | Accent | Fonts | Radius |
| --- | --- | --- | --- | --- |
| **Garden** (main) | fresh, friendly | green `#22C55E` | Bricolage Grotesque + Figtree | 16 |
| **Clay** | warm, bookish | terracotta | Fraunces + DM Sans | 12 |
| **Tide** | cool, precise | cobalt | Space Grotesk + IBM Plex Sans | 8 |

Each has light and dark; **System / Light / Dark** is a separate choice.

## Adding to the UI

- Reach for a token; if none fits, add one to `src/styles.css` (all three themes, light and dark) and to this file.
- Check the new piece at 375 px in light and dark, in all three themes (`/design` has the switch).
