# Bible Study Companion: handoff notes

Read this first when picking the project back up. It records what exists, how it fits together,
the decisions already made (and why), and how the owner likes to work.

- **Live site:** https://justindrewadams.github.io/Bible-study-app/ (GitHub Pages, deployed by
  `.github/workflows/deploy.yml` on every push to `main`, in about 1 minute)
- **Repo:** `justindrewadams/Bible-study-app`, branch `main`
- **Purpose:** a free Bible study app for the owner, family, friends and whoever they share it with.
  It is **non-commercial** (no ads, fees or donations), and must stay that way for the licenses below.

## What the app does

1. **Reader:** pick a book, chapter and translation. The default is the **ESV**; public-domain versions are
   also offered. Tap a verse to see its places on the map. Place names are blue and bold; people's names
   are underlined. A verse bar lists the places and people in the selected verse.
2. **Map** (Leaflet), beside the text on desktop and above it on phones. It has:
   - ancient-style base maps: terrain (default), physical relief, satellite, and the Roman Empire (DARE)
   - a "Modern" overlay with borders and labels, or a full street map, with an opacity slider
   - ancient region names
   - the chapter's places as labelled squares; overlapping ones merge into numbered groups, and labels
     never overlap
   - lakes and rivers drawn as crisp shapes
   - zoom capped at 11 (a regional close-up; no street level)
3. **Place cards:** today's site and how certain it is, other names, founding date, Wikipedia history and photo,
   hand-written key stories (about 75 places), journeys through the place, people born or died there,
   and every verse naming it. Tapping a map square, its label or a place name opens the card.
4. **Person cards and the People page:** about 3,000 people. Cards show other names, tribe, dates,
   birth and death places, period, a **family tree** (grandparents to grandchildren; tap anyone to
   move the tree to them), Easton's biography with tappable references, and every verse naming them.
5. **Journeys** (15): animated stop-by-stop routes with arrows; some legs follow waypoints along real
   routes. Lists include Abraham, Jacob, Joseph, the Exodus, the Conquest, the Ark, David fleeing Saul,
   Elijah, the Exile and Return, Jesus, Saul's conversion, Paul's 3 journeys, and the voyage to Rome.
6. **Study lists** (24), stepped through like journeys: kings (reign dates, good or evil), judges, prophets,
   apostles, miracles, parables, I Am statements, women of the Bible, Paul's letters, the seven churches,
   and more.
7. **Periods page:** **Bob & Sandra Waldron's 17 periods**, with a summary, key people, key events,
   scripture, lists and journeys for each. Every chapter maps to exactly one period, and the reader shows
   "Period N of 17". The chapter boundaries were inferred from the period names because Waldron's
   pages couldn't be fetched. The owner may send corrections (Exodus ends at Exod 18? Flood starts at Gen 6?).

8. **Hymns:** a quiet "♪ Hymns" button beside each chapter title opens a pop-up (a bottom sheet on phones) of
   hymns commonly sung in a cappella Churches of Christ: "Written from this chapter", "Fits this chapter's
   message", and, when a chapter has fewer than 3, suggestions from the book's themes.
9. **Nations page** (`#nations`, `#nations/<id>`): 31 nations and peoples, grouped by Noah's sons (Genesis 10)
   with Abraham's family marked. Each has where they lived (with "Show on map", which pins the homeland), origin
   with a tappable family line of person cards, a short original history, and key verses. A person card shows
   "Ancestor of: …" linking back. Data in `src/data/nations.ts`; `npm run check:nations` validates every person
   slug and reference. Where Scripture doesn't name an ancestor (Rome, Persia, Samaritans…), it says so.

**Name:** the app is called **Bible Study Companion** (renamed from Bible Atlas). The title is two lines,
"BIBLE STUDY" / "COMPANION", sized (15.3px / 14.6px Figtree 800) so both lines are the same width. The repo,
site address and the relay's Cloudflare name (`bible-atlas-esv`) were deliberately kept, since the relay only
answers the existing site address.

## Stack and layout

- Vite + React 18 + TypeScript, react-leaflet 4. No backend except the ESV relay. `npm run dev` / `npm run build`.
- `src/App.tsx`: app state and layout. Holds the header, the ☰ phone menu, routes (`#periods` and `#people`
  via location.hash), the settings modal with **Sources & licenses**, and all wiring.
- `src/components/`:
  - `Reader`, `MapView` (also holds `WaterLayer`, `PlaceAndRegionLabels` and `MapErrorBoundary`), `MapControls`
  - `PlaceCard`, `PersonCard`, `FamilyTree`
  - `JourneyPanel`, `ListPanel`, `PeriodsPage`, `PeoplePage`, `NationsPage`, `HymnsPanel`
- `src/lib/`:
  - `bible.ts`: translations, fetching, ESV rules and caches
  - `geo.ts`, `placeInfo.ts`, `people.ts`
  - `journeys.ts`, `lists.ts`, `usePersistentState.ts`
- `src/data/`:
  - `books.ts` and `regions.ts`
  - `periods.ts`: the 17 periods, `periodFor()`
  - generated: `journeys.json`, `lists.json`, `verseCounts.json`
- `src/data/hymns.ts`: about 210 hymns, each with `from` (passages it was written from), `fits` (thematic
  passages) and `themes`; `BOOK_THEMES` gives each book's fallback themes. **Titles, writers and years only, no
  lyrics** (many are still under copyright). `npm run check:hymns` validates every reference (Node 22.6+).
  Shown by `src/components/HymnsPanel.tsx`, loaded only when the pop-up opens.
- `src/config.ts`: `ESV_RELAY_URL` (public address of the relay).
- `src/styles.css`: one stylesheet, with later sections overriding earlier ones (redesign blocks are appended).

## Data pipeline (`npm run build:data`)

Generated files are committed. Raw downloads are cached in `scripts/.cache/` (git-ignored).

| Script | Source (license) | Outputs |
|---|---|---|
| `build-data.mjs` | OpenBible.info geocoding (CC BY 4.0) plus `journeys.source.json`, `lists.source.json` and `place-stories.json` | `public/data/places.json`, `verses/<Book>.json`, `place-details.json`, `src/data/journeys.json`, `lists.json` |
| `build-people.mjs` | Theographic Bible Metadata (CC BY-SA 4.0) and Easton's Bible Dictionary (public domain) | `public/data/people.json`, `people/<letter>.json`, `people-verses/<Book>.json`, `place-people.json`, `src/data/verseCounts.json` |
| `build-water.mjs` | Natural Earth 10m lakes and rivers (public domain) | `public/data/water.json` |
| `build-relay.mjs` | app book data | `relay/esv-relay.js` |

- **Journeys and lists:** edit the `*.source.json` files. Each item has `place` (the OpenBible name), `ref` (OSIS,
  e.g. `Acts.16.12`) and a `note`. Optional extras:
  - `lookup`: a different verse used to tell same-named places apart
  - `lat`/`lon`: a custom point
  - `via`: route waypoints
  - `meta`, `tag`: extra details and markers on list items
  - `words`: when several list items share one verse (fruit of the Spirit, armor, apostles), the word(s) to
    bold inside it, first match wins; include other translations' wording (KJV "longsuffering")

  The build fails loudly if a place can't be resolved.
- OSIS book codes (`Gen`, `1Kgs`, `Ps`, `Song`, …) are used everywhere.

## Bible text and licensing (important: the owner requires full compliance)

- **ESV only via Crossway's official API, through the Cloudflare relay**
  (`https://bible-atlas-esv.justindrewadams.workers.dev`).
  - The key is a Cloudflare secret, `ESV_API_KEY`. It is never in the repo or the site. Do **not** build keys
    into the site; an attempt to do so was correctly blocked.
  - The relay (`relay/esv-relay.js`, generated) only answers the app's origin, allows at most 500 verses or
    half a book per request, validates ranges, and sends `no-store`. Setup is in `relay/README.md`.
    To change it, edit `scripts/build-relay.mjs`, run `npm run build:relay`, and the owner re-pastes it
    into the Cloudflare dashboard.
  - Readers can add a personal key in Settings as a backup. With no ESV, the app falls back to the WEB
    with a notice.
  - The app enforces the terms: `chapterPages()` splits chapters (Jude shows as 3 parts); ESV is cached in
    memory only, at most 500 verses; the Crossway copyright notice and ESV.org link appear under ESV text.
- **Public domain** (bible-api.com): WEB, KJV, ASV, BBE, Darby, YLT, OEB.
- **bolls.life was removed.** NASB, LSB, NKJV and HCSB are **not** allowed until the owner gets permission
  from the publishers, or uses API.Bible's free non-commercial plan (up to 3 licensed versions; it would go
  through the same kind of relay). `OPEN_TRANSLATIONS` in `bible.ts` is the hook for freely licensed texts.
- Other attributions are listed in Settings → Sources & licenses:
  - Wikipedia CC BY-SA, credited and linked on each place card
  - "Powered by Esri" on the map
  - OSM, DARE, Natural Earth, Theographic, OpenBible
  - Waldron's period outline (the summaries are original)
- Map: no CARTO (its terms needed a license). Esri tiles are only requested up to the levels they cover
  (terrain native z9, upscaled to the z11 cap).

## Design conventions

- A flat, high-contrast style modelled on a sample the owner supplied: thick black outlines, square corners,
  flat color blocks (sky `--sky`, blush `--blush`, leaf, sun, flame), the Figtree sans-serif font, and
  EB Garamond for the Bible text only.
- **Phones must stay calm and uncluttered.** The owner asked for this explicitly:
  - a one-row header with a ☰ menu
  - the ☰ menu is also used from 861 to 1439px wide, because the full header needs about 1440px
  - thin lines, compact cards, no zoom buttons
  - the map takes about 36vh, or 46vh while a journey is active
- Cards: one at a time (place or person). They are a side panel on desktop and a bottom sheet on phones.

## How to work on it (what has worked)

- Before pushing, run `npx tsc && npx vite build`, then a headless **Playwright** check against
  `npx vite preview --port 4173`. Playwright is preinstalled; `require('playwright')` works.
- **The sandbox network blocks** bible-api.com, bolls.life, api.esv.org, workers.dev, map tile hosts and
  Wikipedia. Tests stub these with `page.route(...)` (placeholder verses, 1×1 PNG tiles). Real behaviour can
  only be confirmed by the owner on their phone. Say so plainly when reporting.
- Test both desktop (1400×860) and phone (`devices['iPhone 13']` or 390×844). Check
  `document.documentElement.scrollWidth` for sideways overflow.
- Commit on `main` and push. The Pages workflow deploys, then confirm with the GitHub Actions run status.
- The owner is non-technical. Explain plainly, with clear next steps. Ask before licensing-sensitive changes.

## Recently finished

ESV via relay (confirmed working by the owner), the 17 periods, zoom cap with water shapes, the People page with
family trees, labelled and clustered map squares, tappable labels, the map-toggle crash fix, and the phone layout.

## Ideas not yet started (only if the owner asks)

- Waldron's exact scripture boundaries, once the owner provides them
- More translations through licensed channels
- Notes and highlights; offline use; more journeys and lists
