# Redesign brief: public site

Analysis 2026-10-16, using the `taste-skill:redesign-existing-projects` audit. Status: **approved 2026-10-16** (decisions at the bottom). Step 1 dropped after measurement. All steps done 2026-10-16 (step 1 dropped). Fraunces preload tried and dropped, see step 9; open item: re-measure mobile LCP on a deploy preview.

## Scope

In scope, the pages a visitor sees before signing in:

| Route | File | Today |
|---|---|---|
| `/` | `src/views/LandingView.vue` | Centered logo + H1 + 2 pill buttons + 2x2 card grid |
| `/about` | `src/views/AboutView.vue` | Logo again, bullet list, FAQ as a flat `dl` |
| `/login` | `src/views/LoginView.vue` | Logo, Google button, magic-link form |
| `/privacy`, `/terms` | `PrivacyView.vue`, `TermsView.vue` | Long text pages |
| footer | `src/components/ui/LegalFooter.vue` | 3 underlined links |
| (missing) 404 | none | Unknown URLs bounce to `/login` |

Out of scope: the signed-in app (`/lists`, list detail, settings, stats). It is a daily-use tool with its own UX history; restyling it is a separate brief. Shared tokens (`src/styles/tokens.css`) will only gain new tokens, never change existing values, so the app does not move.

## Constraints (do not break)

- Stack stays: Vue 3 + Tailwind 4 (`@config` on `tailwind.config.ts`) + tokens in `tokens.css`. No new UI framework.
- Brand direction from `SPEC.md` "Branding": Editorial Cream, warm neutrals, single navy primary `--primary #113261`, color only for category icons. Light + dark via `[data-theme]`.
- i18n: every string in `it.json` / `en.json`; no hard-coded copy.
- SEO: keep `useDocumentHead`, JSON-LD blocks, `data-testid` hooks used by e2e (`home-cta`, `home-secondary`, `home-logo`, `about-cta`).
- Perf: logo is the LCP image (`fetchpriority="high"`); keep LCP <= today. No heavy deps (no GSAP, no smooth-scroll lib). `@vueuse/motion` already ships, use it or plain CSS.
- CSP: no new external origins (fonts must be self-hosted via `@fontsource`).
- a11y: axe e2e must stay green; contrast AA in both themes; `prefers-reduced-motion` honored.
- No em-dash anywhere.

## Diagnosis

What the audit found, worst first.

### Real defects

1. ~~Loading veil covers the landing on first visit.~~ **Not a defect.** Measured on prod 2026-10-16: auth resolves right after DOMContentLoaded (LandingView chunk requested at ~90 ms warm, ~180 ms cold with service worker and caches cleared), so `GlobalLoadingOverlay` is up for a frame at most. The spinner seen during the audit came from a backgrounded browser pane stalling the 150 ms fade. No change.
2. **No 404.** `/anything` redirects to `/login`, which reads like "you must sign in" for a typo'd or dead link. Add a branded not-found view.
3. **About repeats the landing** (same logo, same "Inizia ora") and presents features as a plain `list-disc`. It adds little beyond the FAQ.

4b. ~~Hanken Grotesk never loads.~~ **Fixed 2026-10-16** (user approved, whole site and app). `@fontsource-variable/hanken-grotesk` registers `'Hanken Grotesk Variable'`, while `global.css` and `tailwind.config.ts` asked for `'Hanken Grotesk'`, so every page rendered in `system-ui`. Both now use the real family name; lists and list detail checked at 375 px with no clipped text.

### Generic patterns ("template look")

4. **Everything centered and symmetric.** Logo, H1, subtitle, buttons, all on one axis. Classic AI-landing composition.
5. **2x2 equal cards with icon-in-tinted-square + title + body.** The most recognisable generic feature grid (bordered offwhite card, `bg-primary/10` icon chip).
6. **Filled pill + ghost pill CTA pair.** The secondary "Scopri di piu" competes with the primary for no reason.
7. **No product shown.** The page never shows what a list looks like. For a shopping-list app the product itself is the best visual; today the only image is the logo.
8. **Headline lacks presence.** `text-4xl/5xl font-semibold`, default tracking, same weight family as body.
9. **Flat surfaces.** Plain cream, no depth, no texture; sections only separated by whitespace.
10. **Footer** is three tiny underlined links centered under a `max-w-3xl` column; no brand, no locale, no year.

### Already good (keep)

- Warm cream / charcoal palette, single accent: already passes the "one accent, no AI gradient" checks.
- `text-balance` / `text-pretty`, `min-h-dvh`, focus rings, active states on CTAs.
- Self-hosted variable font, AVIF logo, JSON-LD, sr-only H2.

## Proposed direction

**"Editorial grocery receipt."** Keep the cream and navy, push the editorial side of the SPEC harder: big confident type, asymmetric layout, and the product itself as the hero visual, drawn in HTML/CSS (not a screenshot, so it stays crisp, themable and translatable).

### Typography

- Option A (recommended): add a **display serif for headings only** on public pages (self-hosted `@fontsource-variable/fraunces` or `instrument-serif`), Hanken Grotesk stays for body and the whole app. Editorial cream + serif display is the natural fit and gives the H1 real presence.
- Option B: stay Hanken-only, push the H1 to `clamp(2.75rem, 6vw, 4.5rem)`, weight 600, tracking `-0.03em`, line-height 1.02.
- Either way: tabular figures for the mock list quantities; small labels with positive tracking in sentence case.

### Landing layout (`/`)

1. **Header bar**: small wordmark (`branding/wordmark.svg`, `currentColor`) left, locale switcher + "Accedi" text link right. The big banner logo leaves the hero (it carries a tagline "YOUR SMART GROCERY LIST" in English that fights the Italian H1).
2. **Hero, split 7/5 on desktop, stacked on mobile**: left-aligned H1 + subtitle + one primary CTA, "Scopri di piu" demoted to a text link. Right: a **live-looking list card mock** (3-4 categories, emoji icons with the real `--cat-*` hues, one item checked with strike-through, a collaborator avatar pair, a "Marco ha aggiunto Latte" sync chip). Slight rotation and a tinted shadow for depth. Mock items animate in with a short stagger (CSS, reduced-motion aware).
3. **Feature section as 2-column zig-zag** instead of the 2x2 grid: each row = short heading + one sentence + a small inline visual (offline badge on a list, two phones syncing, the Claude prompt bubble "aggiungi quello che serve per una carbonara" turning into items). No icon chips.
4. **Privacy statement as a full-width typographic band**: one large sentence ("Nessuna pubblicita, nessun tracking, nessuna analytics.") on `--cream-soft`, same palette, no dark section jump.
5. **Closing CTA** + footer.

### About (`/about`)

- Drop the repeated logo + CTA hero; plain editorial header (H1 + intro paragraph, left-aligned, 65ch).
- Features as a two-column definition list (term / one line), not bullets.
- FAQ side by side on desktop (question left, answer right), stacked on mobile. No accordion.

### Login (`/login`)

- Light touch only: same header/wordmark as the landing, the cart icon instead of the full banner logo, card-less centered form stays (it works). No change to auth logic or buttons' behavior.

### Footer (`LegalFooter`)

- Wordmark + one-line claim left, links right (Chi siamo, Privacy, Termini), dynamic year (`new Date().getFullYear()`, build-time fallback) per the global rule. Keep the `dense` variant used inside the app untouched.

### 404

- New `NotFoundView.vue` on `/:pathMatch(.*)*`, public route, with a small illustration (existing `empty-*.svg`), "Questa pagina non e nella lista" style copy and a link home. Router meta + e2e route list updated.

### Surfaces and motion

- Subtle grain overlay on the public pages only (inline SVG noise, `pointer-events: none`, opacity ~0.04), tinted navy shadows on the mock card.
- Staggered entry on hero and zig-zag rows via `@vueuse/motion` (already a dep), disabled under `prefers-reduced-motion` and in e2e (`VITE_E2E`).
- Hover: CTA slight lift + `scale(0.98)` on press; text links with animated underline.

### Copy

- Keep the current Italian copy mostly; tighten the subtitle (one sentence, ~20 words). New strings: mock list items, zig-zag headings, privacy band, 404, footer claim, in `it` and `en`.

## Execution plan (after approval)

Small steps, each verified in the browser preview at 375 px and 1440 px, light and dark:

1. ~~Fix the loading veil on public routes.~~ Dropped, see diagnosis 1.
2. **Done 2026-10-16.** Tokens: `--font-display` (Fraunces Variable, `@fontsource-variable/fraunces` 5.3.0, wght normal + italic), `--shadow-lift` (navy-tinted, neutral on dark), `--grain-opacity`; Tailwind `font-display` + `shadow-lift`; `src/styles/public.css` (font import + `.public-grain`), imported by `LandingView` so far. Fraunces woff2 excluded from the PWA precache (`src/pwa/manifest.ts`, about 180 KB) since installed users never see it. No existing token value changed.
3. **Done 2026-10-16.** `src/components/public/PublicHeader.vue` (cart icon `branding/logo-icon-80.png` + "Buy The Way" in Fraunces, locale switcher, "Accedi" link; brand text hidden below 360 px) on landing, about, privacy, terms. `LegalFooter` default variant rebuilt (brand + claim, links with 44 px targets, runtime year); `dense` variant (login, settings) unchanged. New i18n keys: `public.header.*`, `legal.footer.claim`.
4. **Done 2026-10-16.** Landing hero: 7/5 split on `lg`, left-aligned Fraunces H1 with an italic accent word (`home.heroTitle` + `{accent}` slot, colour token `--primary-ink`, lifted to `#9db8e6` on dark), one-sentence subtitle, primary CTA with arrow, "Scopri di piu" as a text link (`router-link`, same `home-secondary` testid), `home.heroNote`. Right: `src/components/public/ListMock.vue`, a decorative (`aria-hidden`) list drawn with the real row anatomy, CSS stagger, progress grow, "Marco ha aggiunto Basilico" toast; static under reduced motion and `VITE_E2E`. Banner logo and its `home-logo` testid removed from the hero (no test referenced it), so the LCP element is now the H1: check Lighthouse. Grain applied to the landing `main`.
5. **Done 2026-10-16.** The 2x2 icon-card grid is gone. Visible H2 "Pensata per la spesa vera", then three zig-zag rows (sync, offline, AI assistant marked "In beta") with numbered labels and decorative HTML vignettes in `src/components/public/FeatureVisual.vue`; full-width privacy band on `--cream-soft` with a link to `/privacy`; closing CTA (`home-cta-bottom` testid). Rows reveal on scroll via `@vueuse/motion`, off under reduced motion and `VITE_E2E`. i18n: `home.highlights` array replaced by `home.features`, `home.privacyBand`, `home.closing`.
6. **Done 2026-10-16.** About: logo and top CTA removed; left-aligned Fraunces H1 + intro (60ch); features as a hairline-ruled `dl` (`about.features` is now `{ term, desc }[]`); FAQ as `dl` with question and answer side by side from `md`; closing band with the CTA (`about-cta` testid kept, `about.closingTitle`).
6b. **Done 2026-10-16.** Privacy and Terms: copied About hero (logo, CTA, a second `h1`) removed. Both render `src/components/public/LegalArticle.vue`: Fraunces H1, last-updated date, sticky table of contents beside the text on `lg` (`legal.toc`), sections at 65ch. Testids `privacy-cta` / `terms-cta` dropped (no test used them).
7. **Done 2026-10-16.** Login: `PublicHeader` without the sign-in link replaces the corner locale switcher; the banner logo becomes the small tilted cart (`login-logo` testid kept) and the page gains a real `h1` (`auth.loginTitle`, `auth.loginSubtitle`). Sign-in buttons, magic-link form, dense footer, credits and version untouched.
8. **Done 2026-10-16.** `src/views/NotFoundView.vue` on `/:pathMatch(.*)*` (route `not-found`, public in `ROUTE_META`, `seo.notFound`, `robots: noindex`): heading "Questa pagina non e nella lista.", home CTA + "Le mie liste" link, a mini list whose unticked item is the missing path. Covered by two tests in `tests/unit/router/guard.test.ts` (unknown path resolves to `not-found` without shadowing real routes; anonymous visitors are not bounced to `/login`).
9. **Done 2026-10-16.** Gates: lint, typecheck, `pnpm test:coverage` (513 tests), build, `pnpm test:e2e` (21 passed, 1 skipped, axe on `/` and `/login`), extra one-off axe run on `/about`, `/privacy`, `/terms`, the 404 and `/` dark (all clean, spec not kept), em-dash grep. Two real bugs found and fixed here:
   - **Hanken never loaded in builds, even with the right name.** `@import`ing the fontsource CSS from `global.css` sent it through Tailwind, which left `url(./files/...)` unrewritten, so the woff2 requests hit the SPA fallback (also true on prod today). Now imported from `src/main.ts`; the font is emitted to `/assets` and precached.
   - **No LCP on text-only pages.** `App.vue` faded in the very first view too (router-view going from empty to the initial route counts as an enter), so the hero painted at opacity 0 and Chrome reported `NO_LCP` on desktop. The first view now renders without the fade (`:css="fadeViews"`); later navigations still fade.
   - Lighthouse, local build behind `serve -s` (gzip, HTTP/1.1) vs prod (CDN, h2), not like for like. New: mobile 77 (FCP 3.4 s, LCP 4.5 s on the H1, CLS 0.003, TBT 0), desktop 99 (LCP 0.9 s); a11y, best practices, SEO 100. Prod today: mobile 89-92 (FCP 2.5-2.6 s, LCP 2.9-3.3 s on the logo), desktop 100. Most of the FCP gap is the local server. **Follow-up tried and dropped (2026-10-16):** preloading Fraunces on `/` (unhashed latin copies in `public/fonts/`, upright and italic, plus a Netlify `Link: rel=preload` header scoped to `/`) made both files the first requests (7-11 ms) but left Lighthouse unchanged: mobile 77, LCP 4.5 s, desktop 99, LCP 0.9 s, three runs each. The LCP breakdown is about 10% TTFB and 90% render delay: the H1 waits for the main bundle (Vue, Firebase auth and Firestore) to run under simulated CPU throttling, for auth to be ready and for the lazy landing chunk, not for the font. Making the landing an eager import gained only 0.1-0.3 s (77-79), not worth pushing it into every app user's bundle. Nothing kept. Real levers, if needed: keep Firebase off the critical path for public routes, or prerender the landing HTML. Re-measure on a Netlify deploy preview first, since prod (CDN, h2) had the same architecture at mobile 89-92.

## Decisions (2026-10-16)

1. Typography: **A**, a self-hosted display serif for headings on public pages only. Hanken Grotesk stays for body text and the whole app.
2. Scope: **public site only**. The signed-in app is not part of this brief.
3. Icons: **keep `@lucide/vue`**.
