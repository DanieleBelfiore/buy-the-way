# Redesign brief: signed-in app

Analysis 2026-10-16, using the `taste-skill:redesign-existing-projects` audit. Status: **approved 2026-10-16** (decisions at the bottom). All six steps done 2026-10-16, plus a follow-up pass on the pre-existing accessibility issues found in step 6. Companion of [`redesign-brief.md`](redesign-brief.md), which covered the public site only.

## Scope

In scope, the screens a user sees after signing in:

| Route | File | Today |
|---|---|---|
| `/lists` | `src/views/ListsView.vue` | Icon bar, raster logo as header, list cards with wallpaper, FAB |
| `/lists/:id` | `src/views/ListDetailView.vue` | Header, progress strip, category groups, item rows, sticky add-item footer |
| `/lists/:id/settings` | `src/views/ListSettingsView.vue` | Rename, wallpaper grid, members, invite, delete |
| `/settings` | `src/views/SettingsView.vue` | Account, theme, language, connected apps, action buttons, footer |
| `/stats` | `src/views/StatsView.vue` | 5 total cards, top items bar chart, category donut |
| sheets and modals | `src/components/list/*Sheet.vue`, `src/components/ui/ConfirmModal.vue` | Edit, priority, move/copy, favorites, suggest, bulk paste, voice |

Out of scope: `/oauth/authorize` and the email-link callback (rare, functional screens), the onboarding tour, the PWA prompts.

The app is a tool people use in a supermarket aisle, one hand on a trolley. The bar is "faster and calmer to use", not "more striking". So the skill's marketing advice (bigger whitespace, display serif, scroll reveals, grain) does **not** apply here.

## Constraints (do not break)

- Same as the public brief: Vue 3 + Tailwind 4 + tokens in `tokens.css`, Lucide stays, i18n for every string, no em-dash, CSP unchanged, axe e2e green in both themes, `prefers-reduced-motion` honored.
- Fraunces stays out of the app (it is excluded from the precache on purpose). The app keeps Hanken Grotesk only.
- No change to the data flows, stores, gestures (long-press drag, pull to refresh, swipe-to-dismiss toast) or `data-testid` hooks used by e2e.
- Touch targets stay at 44 px minimum. Offline and realtime behavior unchanged.

## Diagnosis

Checked live on the emulator at 375 x 812, light and dark, on 2026-10-16, plus a code read of the views above.

### Real defects

1. **Long item names shrink to about 10 px.** `ListItemRow` scales the name down to fit one line. "Mozzarella di bufala campana" renders at `scale(0.68)` of 14.9 px, which is unreadable at arm's length in a shop. Wrapping to two lines would keep the text at full size.
2. **Stats chart ignores the app font and clips labels.** The bar chart labels render in Chart.js's default font, not Hanken. Long names are cut on the left ("zarella di bufala campana").
3. **Truncated action in the edit sheet.** At 375 px the "Aggiungi ai preferiti" button reads "Aggiungi ai prefer".
4. **`/lists` has no heading.** The page title is the logo image. axe does not flag it (the rule is best practice, not WCAG), but screen-reader users land on a page with no `h1`.

### Generic or noisy patterns

5. **Three icon buttons on every item row** (flag, gear, trash): 132 px of a 375 px row, repeated on every line, also on bought items. It is the main source of visual noise in the screen people use most.
6. **Red everywhere, in five shades.** `red-500/600/700/800/900` are used ad hoc. In Settings, "Esci" (sign out, harmless) is a red slab next to "Elimina account" (irreversible) in a darker red, so the two read as equally dangerous. In list settings, "Elimina lista" is a full-width red slab always on screen.
7. **Disabled buttons look like a different colour.** `disabled:opacity-40` on navy over cream gives a grey-blue ("Salva", "Aggiungi" in list settings) that reads as a second accent rather than "not yet".
8. **All-caps micro labels** (`text-xs uppercase tracking-wide`) head every section in 6 files. The skill flags this; sentence case in a slightly heavier weight reads calmer.
9. ~~**Mixed overlay patterns.**~~ **Wrong, corrected 2026-10-16.** Every overlay in the app (edit, priority, move/copy, favorites, suggest, bulk paste, voice, feedback, confirm) is the same centered card over a dimmed backdrop. The audit misread move/copy as a bottom sheet. The overlays are already consistent.
10. **Shrinking button labels.** Settings buttons use `text-[clamp(0.75rem,3.2vw,0.9rem)]` plus `truncate`, so labels get smaller instead of the layout adapting.
11. **Stats totals**: 5 cards in a 2-column grid leave an orphan card; the numbers are large but carry no context (no period, no comparison).
12. **Ad-hoc z-index ladder**: `z-10`, `z-50`, `z-[100]`, `[110]`, `[120]`, `[130]`, `[150]`, `[200]`, `[250]` with no named scale.

### Already good (keep)

- 44 px targets throughout, safe-area insets, `fixed inset-0` shells that work in iOS standalone.
- Skeleton loaders that match the layout, Lottie empty states with a clear next step ("La solita spesa").
- Undo toast on delete, confirm modals on irreversible actions.
- Progress strip with `tabular-nums`, category counters, completion celebration.
- Dark mode is consistent: same hierarchy, no stray light surfaces.
- Reduced-motion handling on every custom transition.

## Proposed direction

Small, targeted changes, each one shippable on its own. No new layout for any screen.

### Item row (`ListItemRow`)
- Names wrap to at most 2 lines at full size instead of scaling down; note and badges flow on the second line.
- All three row icons stay (decision 1 = c). Restyle only: lighter weight and muted colour at rest, full colour when a priority is set.
- Bought rows: dim the action icons along with the name, so the eye goes to what is still to buy.

### Colour and states
- One `--danger` token (plus hover and dark variants) in `tokens.css`, replacing the five red shades.
- Sign out becomes a neutral secondary button. Delete account and delete list become a danger-outline or text button, kept at the bottom, with the confirm modal unchanged.
- Disabled primary: muted fill (`bg-cream-soft text-muted-gray`) instead of 40% opacity navy.

### Typography
- Section labels: sentence case, `text-sm font-semibold text-muted-gray`, no tracking.
- Chart.js `defaults.font.family` set to Hanken, so the stats screen matches the rest.
- `/lists` gets a visually hidden `h1` ("Le mie liste"); the logo stays as it is.

### Overlays
- ~~Priority picker becomes a bottom sheet like move/copy (decision 2).~~ Dropped: decision 2 rested on finding 9, which was wrong. The priority picker stays a centered card like every other overlay.
- Edit sheet actions: two-row layout or shorter labels so nothing truncates at 320 px.
- A named z-index scale in `tailwind.config.ts` (`z-sheet`, `z-modal`, `z-toast`, `z-overlay`) replacing the bracket values.

### Stats
- Totals: 2 primary figures large, the other 3 as a compact row.
- Chart labels truncated with an ellipsis at the end, not clipped at the start.

## Execution plan (after approval)

1. Item row: 2-line names, dimmed actions on bought rows, restyled row icons (all three kept). **Done 2026-10-16.**
   - Names wrap to 2 lines at full size with an ellipsis after that; `useFitText` (only used here) is deleted. The global `button > span { white-space: nowrap }` rule in `global.css` is unlayered and beats Tailwind utilities, so the name container sets `white-space: normal` inline.
   - Action icons: stroke 1.75 and `muted-gray/90` at rest, `/75` on bought rows; a set priority keeps stroke 2 and full colour. Measured contrast against the page: light 4.58 (rest) and 3.39 (bought), dark 5.63 and 4.33, all above the 3:1 needed for UI icons.
   - Trade-off of decision 1 (c): at 320 px the name column is about 97 px wide, so a long name shows roughly 12 characters per line before the ellipsis ("Detersivo per / lavastoviglie in..."). At 375 px "Mozzarella di bufala campana DOP" fits in full.
   - Found, not fixed (outside step 1): the row toggle is a `button` that contains the `InfoHint` buttons (nested interactive elements); its `aria-label` ("Segna come comprato") replaces the item name for screen readers; urgent names use `text-orange-500`, below 4.5:1 on cream. Candidates for step 2.
2. `--danger` token and the destructive and disabled button pass (Settings, list settings, modals). **Done 2026-10-16.**
   - Tokens `--danger`, `--danger-hover`, `--danger-active`, `--danger-ink`, `--danger-soft` (light and dark) replace every `red-*` class in `src` (27 spots, five shades). The fill stays `#b91c1c` in dark so white text keeps 6.47:1; the ink lifts to `#f87171` on dark (6.58:1). The red text on the OAuth and email-link screens moved to the token too, since it was a straight swap.
   - Sign out is now a neutral secondary button. Delete account, delete list, leave list, remove photo and the collaborator "leave" button are danger outlines. The confirm button inside a destructive modal stays a solid danger fill, since that is the point of no return.
   - Disabled primary buttons (9, signed-in app only): `disabled:bg-cream-soft disabled:text-muted-gray` instead of 40% opacity. `disabled:` sorts after `hover:` in Tailwind 4, so a hovered disabled button stays muted. OAuth, email-link, login and update prompt keep their opacity style (out of scope).
   - Urgent: new `--urgent` and `--urgent-soft` tokens replace `orange-500/400/50`. Name and icon contrast on cream goes from about 2.8:1 to 4.71:1 (dark 8.04:1); the selected option in dark no longer shows a light `orange-50` patch.
   - Row toggle label now carries the item name ("Segna Latte come comprato"); 5 e2e assertions updated.
   - Still open: the row toggle `button` contains the `InfoHint` buttons (nested interactive elements). Fixing it means moving the badges out of the toggle; left for step 4 with the other overlay work.
3. Section labels to sentence case; hidden `h1` on `/lists`. **Done 2026-10-16.**
   - 13 labels across Settings, list settings, connected apps and the item edit sheet move from `text-xs uppercase tracking-wide` to `text-sm font-semibold text-muted-gray`; the category group titles in the favorites and suggest sheets get the same treatment at `text-xs`. The i18n strings were already sentence case, so no copy changed. The "In attesa" invite badge stays uppercase: it is a badge, not a section label.
   - `/lists` has a `sr-only` `h1` from the new `list.pageTitle` key ("Le mie liste" / "My lists").
   - Seen for step 4: when the item edit sheet opens, its panel shows the gold focus outline around the whole sheet (the dialog receives focus). Same outline on the first option of the priority picker.
4. Overlays: edit sheet actions, z-index scale, nested buttons in the row, focus outline on dialogs. **Done 2026-10-16.** The priority picker stays as it is (decision 2).
   - Edit sheet actions wrap (`flex-wrap`, `basis-[12.5rem]`): stacked on phones, side by side from about 448 px. Labels are no longer cut.
   - Named stacking layers in `tailwind.config.ts` (`z-dropdown`/`z-boot` 50, `z-sheet` 100, `z-lightbox` 110, `z-modal` 120, `z-tooltip` 130, `z-banner` 150, `z-toast`/`z-tour` 200, `z-update` 250). Ten names, not four: they keep the exact values used before, so nothing changes order. The local `z-10` inside each overlay stays numeric.
   - Item row: the toggle is a transparent button stretched over the check, emoji and name; the InfoHint badges are siblings positioned above it. No more button inside a button, same look. The row root has `data-testid="list-item-row"`; e2e locate rows through it (6 locators updated). Checked live: tap on the name toggles, tap on a badge opens its tooltip only, long press enters bulk selection.
   - `[role='dialog']:focus { outline: none; }` in `global.css`: the panel takes focus only as a landing spot, so no outline around the whole sheet. Controls inside keep their focus indicator.
5. Stats: chart font, label truncation, totals layout. **Done 2026-10-16.**
   - Both charts set `ChartJS.defaults.font.family` from `getComputedStyle(document.body).fontFamily`: the canvas cannot inherit CSS, so it used Helvetica. Checked on a hard reload of `/stats` too.
   - Bar labels longer than 18 characters (emoji included) end with "…" ("Mozzarella di…") instead of being clipped at the start; the tooltip keeps the full name.
   - Totals: "Acquisti totali" and "Articoli unici" as two large figures, then lists, collaborators and favorites in one compact row (`dl`, label read before value). The loading skeleton follows the same shape. `data-testid="stats-total-*"` kept on every figure.
6. Gates: lint, typecheck, `pnpm test:coverage`, `pnpm test:e2e` with axe, manual pass at 320 and 375 px in both themes. **Done 2026-10-16.**
   - Gates: lint and typecheck clean; `pnpm test:coverage` 60 files, 513 tests, no warnings (coverage 41.4% lines, informational); `pnpm test:e2e` 21 passed, 1 skipped; `pnpm build` passes (the only warning is the pre-existing 532 kB Firestore chunk). No em-dash, no `red-*`, `orange-*` or bracket z-index left in the app.
   - Walk: a throwaway Playwright script (not committed) opened every signed-in screen (lists, detail, edit sheet, priority picker, list settings, settings, stats) at 320 and 375 px in light and dark, checking horizontal overflow and running axe on each.
   - Fixed during the walk: at 320 px the rename and invite rows overflowed by 23 px (the inputs did not shrink); `min-w-0` on both inputs.
   - Found, pre-existing (none came from this redesign; checked against the original files where in doubt), **all fixed 2026-10-16** in a follow-up pass:
     - Item edit sheet: each `label` now has `for` pointing at its field (`useId`), which also names the category `select`; "Foto" and "Azioni" became `h3` since they head a group, not one field.
     - `ListCard`: no longer a `role="button"` div wrapping the pin button. A transparent button stretched over the card (`data-testid="list-card-open"`, `aria-label` = list name) opens the list; the pin is a positioned sibling on top. Same pattern as the item row.
     - Charts: `vue-chartjs` already renders the canvas with `role="img"`; both charts now pass an `aria-label` with the data as text ("Top 10 articoli più usati. Latte: 3, Pane: 2, ..." and "Per categoria. Latticini 40%, ...").
     - Finding 10, shrinking labels: Settings buttons drop `truncate` plus `clamp()` for `text-sm`, and the two-up rows wrap (`flex-wrap` with `basis-[12.5rem]` / `basis-[10rem]`); the edit sheet photo buttons wrap at `basis-[8.5rem]`. `useButtonTextFit` stays but no longer has anything to shrink on these screens.
     - The `ResizeObserver loop` warnings are gone with it, which confirms they came from `useButtonTextFit` shrinking text inside its own observer callback.
     - Side effect caught by the walk: with the wrapped buttons the item edit sheet grew taller than a 320 x 700 screen and could not scroll. It now has `max-h-[calc(100dvh-2rem)] overflow-y-auto`, like the move/copy, suggest and favorites sheets.
   - Final walk (320 x 568, 320 x 700, 375 x 812; light and dark; every signed-in screen plus edit sheet and priority picker): no axe serious or critical violation, no horizontal overflow, no shrunk text, every dialog inside the viewport, no `ResizeObserver` warning. Gates after the pass: lint and typecheck clean, 513 unit tests, e2e 21 passed and 1 skipped, build passes.

## Decisions (2026-10-16)

1. **Item row actions.** (a) Keep flag + gear, drop the trash icon: delete moves into the edit sheet (it has none today) and stays in bulk select, both with undo. (b) Keep only the gear; priority shows as a small flag only when set and is changed from the sheet. (c) Keep all three, only restyle. **Decided 2026-10-16: (c).**
2. **Priority picker.** Bottom sheet, or a segmented control inside the edit sheet. ~~Decided 2026-10-16: bottom sheet.~~ **Reopened 2026-10-16**: the choice assumed the other overlays were bottom sheets, and they are not. **Decided 2026-10-16: keep the centered cards, no change.** All ten overlays already share that shape; moving them all to bottom sheets would touch eight components, several with text fields that fight the iOS keyboard when anchored to the bottom. If wanted later, it is a separate pass tested on a real iPhone.
3. **Scope of step 3.** Sentence-case labels are a visible change across every settings screen; skip it if the current look is intentional. **Decided 2026-10-16: sentence case.**
