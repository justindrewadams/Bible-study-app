# Bible Study Companion: handoff notes

Read this first when picking the project back up. It records what exists, how it fits together,
the decisions already made (and why), and how the owner likes to work.

- **Live site:** https://justindrewadams.github.io/Bible-study-app/ (GitHub Pages, deployed by
  `.github/workflows/deploy.yml` on every push to `main`, in about 1 minute)
- **Repo:** `justindrewadams/Bible-study-app`, branch `main`
- **Name:** **Bible Study Companion** (renamed from "Bible Atlas" in November 2026). The repo name, the site
  address and the relay's Cloudflare name (`bible-atlas-esv`) were deliberately **kept**: the relay only answers
  the existing site address, so renaming the repo would break the ESV.
- **Purpose:** a free Bible study app for the owner, family, friends and whoever they share it with.
  It is **non-commercial** (no ads, fees or donations), and must stay that way for the licenses below.

## What the app does

1. **Reader:** pick a book, chapter and translation. The default is the **ESV**; public-domain versions are
   also offered. Tap a verse to select it (light sky-blue highlight, black bar on the left) and see its places on
   the map. Place names are blue, bold and underlined; people's names have a pink underline. A blue verse bar
   lists the places and people in the selected verse.
2. **Map** (Leaflet), beside the text on desktop and above it on phones:
   - ancient-style base maps: terrain (default), physical relief, satellite, and the Roman Empire (DARE)
   - a "Modern" overlay with borders and labels, or a full street map, with an opacity slider
   - ancient region names
   - the chapter's places as labelled squares; overlapping ones merge into numbered groups; labels never overlap
   - lakes and rivers drawn as crisp shapes; **rivers and lake outlines get thinner and lighter when zoomed out**
     (`waterStyle()` in `MapView.tsx`: full strength from zoom 8)
   - a verse that names places gets red pins with boxed labels; a verse that names none shows the place
     **last mentioned** (often Jerusalem) as a **small black dot with a plain name** (no box, no pin)
   - zoom capped at 11 (a regional close-up; no street level)
3. **Place cards:** today's site and how certain it is, other names, founding date, Wikipedia history and photo,
   hand-written key stories (about 75 places), journeys through the place, people born or died there,
   and every verse naming it.
4. **Person cards and the People page** (`#people`): about 3,000 people. Cards show other names, tribe, dates,
   birth and death places, period, a **family tree**, Easton's biography with tappable references, every verse
   naming them, and, for nation founders, **"Ancestor of: …"** linking to the Nations page.
5. **Journeys** (15): animated stop-by-stop routes (Abraham, Exodus, Paul's journeys, and more).
6. **Study lists** (24), stepped through like journeys: kings, judges, prophets, apostles, miracles, parables,
   fruit of the Spirit, armor of God, and more. When several items share one verse (fruit of the Spirit, armor,
   apostles), the current item's word is **bolded** inside that verse (owner chose bold over a highlight).
7. **Periods page** (`#periods`): **Bob & Sandra Waldron's 17 periods**. Every chapter maps to one period, and the
   reader shows "Period N of 17". Boundaries were inferred from the period names; the owner may send corrections.
8. **Hymns:** a quiet "♪ Hymns" button beside each chapter title opens a pop-up (bottom sheet on phones) of hymns
   commonly sung in **a cappella Churches of Christ**: "Written from this chapter", "Fits this chapter's message",
   and, when a chapter has fewer than 3, suggestions from the book's themes. **Titles, writers and years only.**
9. **Nations page** (`#nations`, `#nations/<id>`): 31 nations and peoples grouped by Noah's sons (Genesis 10),
   Abraham's family marked. Each has where they lived ("Show on map" pins the homeland), origin with a tappable
   family line of person cards, a short original history, and key verses. Where Scripture doesn't name an
   ancestor (Rome, Persia, Samaritans, Kenites, Anakim, Sheba), it says so rather than guessing.
10. **Hebrew & Greek word study:** select a verse, then tap **HEBREW**/**GREEK** in the blue verse bar. A card lists
    every original word (word, transliteration, gloss, Strong's). Tapping a word shows its dictionary form,
    plain-English grammar, a brief lexicon entry with tappable verse links, and other verses using it; jumping to
    one moves the reader and marks the same word there. Greek follows Nestle-Aland (as the ESV does); words only
    in the KJV's Greek (Textus Receptus, e.g. 1 John 5:7) are shown faded and labelled. Hebrew skips LXX-only words.
11. **Search** (the box in the header from 861 to 1439px wide; a magnifying glass on phones and, at 1440px+, right after "Study a list", which
    opens a bar under the header): one search across people (including other names, e.g. "Saul" finds Paul), places
    (names, other spellings, key stories, birth/death places of the person searched, stops of journeys named after
    them), journeys, study lists and their items, periods, nations, hymns (titles and writers only) and Bible
    references ("John 3:16", "1 cor 13", "Psalm 23"). The searched word is bolded in each excerpt; Enter opens the first
    result. It searches **only the app's own data, never Bible text** (searching the ESV would need Crossway's search
    API: ask the owner first). Code: `src/lib/search.ts` (index, matching, ranking) and `components/SiteSearch.tsx`.
12. **Distance tool:** a "↔ Distance" button on the map (beside "Modern") or "↔ Distance from <place> to…" on a place
    card. Choose two places by typing (suggestions from all ~1,300 places) or by tapping them on the map; while it is
    open, tapping a place fills the next slot instead of opening its card. Shows the distance **by Roman road**
    (shortest route over the Itiner-e network, drawn in yellow with a dark edge) with a time on foot at 20 miles a day,
    and the straight line (thin dashed). Places more than 30 miles from a road (e.g. Ur, Mesopotamia) get "no Roman road
    is known near…"; places with no road between them (Cyprus, across the sea) say so; very roundabout land routes
    (e.g. Caesarea–Rome) add "most travellers would have gone much of this way by sea". Regions (e.g. Egypt) measure
    from their single map point. On phones the map grows to 56vh while measuring. Code: `lib/distance.ts`,
    `lib/roads.ts` (graph + Dijkstra), `components/DistancePanel.tsx` (`useRoadRoute`), `MeasureLayer` in `MapView.tsx`.
    The road file (`public/data/roads.json`, ~540 KB, ~210 KB gzipped) loads only when two places are picked.
13. **Sources & licenses** pop-up (the ⚙ button): lists every source and license. The personal ESV key field was
    **removed** at the owner's request (a key saved by an older version is still used quietly as a backup).

## Stack and layout

- Vite + React 18 + TypeScript, react-leaflet 4. No backend except the ESV relay. `npm run dev` / `npm run build`.
- `src/App.tsx`: app state and layout: header, ☰ menu, hash routes (`#periods`, `#people`, `#nations`), the
  Sources & licenses pop-up, and all wiring. **Only one card at a time** (place, person or word study).
- `src/components/`:
  - `Reader` (chapter title row with the Hymns button, verses, list-word bolding), `MapView` (also `WaterLayer`,
    `PlaceAndRegionLabels`, `MapErrorBoundary`), `MapControls`
  - `PlaceCard`, `PersonCard`, `FamilyTree`, `WordStudy`, `HymnsPanel`, `SiteSearch`, `DistancePanel`
  - `JourneyPanel`, `ListPanel`, `PeriodsPage`, `PeoplePage`, `NationsPage`
- `src/lib/`: `bible.ts` (translations, fetching, ESV rules), `geo.ts`, `placeInfo.ts`, `people.ts`,
  `journeys.ts`, `lists.ts`, `words.ts` (word-study loaders), `search.ts`, `distance.ts`, `usePersistentState.ts`
- `src/data/`:
  - `books.ts`, `regions.ts`, `periods.ts`
  - `hymns.ts`: ~210 hymns with `from` (passages written from), `fits` (thematic passages) and `themes`;
    `BOOK_THEMES` for fallbacks. Loaded only when the pop-up opens.
  - `nations.ts`: the 31 nations (`family`, `line` of person slugs, `related`, `lat`/`lon`, `history`, `refs`)
  - generated: `journeys.json`, `lists.json`, `verseCounts.json`
- `src/config.ts`: `ESV_RELAY_URL`.
- `src/styles.css`: one stylesheet; later sections override earlier ones (newer blocks are appended at the end).

## Data pipeline

Generated files are committed. Raw downloads are cached in `scripts/.cache/` (git-ignored).

| Command / script | Source (license) | Outputs |
|---|---|---|
| `npm run build:data` → `build-data.mjs` | OpenBible.info geocoding (CC BY 4.0) + `journeys.source.json`, `lists.source.json`, `place-stories.json` | `public/data/places.json`, `verses/<Book>.json`, `place-details.json`, `src/data/journeys.json`, `lists.json` |
| (same) → `build-people.mjs` | Theographic Bible Metadata (CC BY-SA 4.0), Easton's (public domain) | `public/data/people.json`, `people/<letter>.json`, `people-verses/`, `place-people.json`, `people-aka.json` (other names, for search), `verseCounts.json` |
| (same) → `build-water.mjs` | Natural Earth (public domain) | `public/data/water.json` |
| `npm run build:relay` | app book data | `relay/esv-relay.js` |
| `npm run build:roads` → `build-roads.mjs` | Itiner-e static version 2024 (CC BY 4.0, zenodo.org/records/17122148) | `public/data/roads.json` (Bible lands + Mediterranean, simplified, road ends joined into a network) |
| `npm run build:words` | STEPBible TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC (CC BY 4.0) | `public/data/words/<Book>/<chapter>.json`, `lexicon/<H\|G><n>.json`, `grammar-H.json`, `grammar-G.json` |

Checks (Node 22.6+): `npm run check:hymns` and `npm run check:nations` validate every reference and person slug.

- **Journeys and lists:** edit the `*.source.json` files. Each item has `place`, `ref` (OSIS, e.g. `Acts.16.12`)
  and a `note`. Optional: `lookup`, `lat`/`lon`, `via`, `meta`, `tag`, and `words` (when items share a verse:
  the word(s) to bold, first match wins; include other translations' wording, e.g. KJV "longsuffering").
  If you can't rerun `build:data` (it needs the OpenBible cache), apply the same change to `src/data/lists.json`.
- **Word study data:** `build:words` downloads ~110 MB of STEPBible files into `scripts/.cache/step` on first run.
  Output is ~37 MB, split per chapter (≈20–80 KB each) and per 500 Strong's numbers, so nothing loads until a
  verse is opened. 26 rare extended Strong's numbers have no lexicon entry; the app falls back to the entry with
  the same base number.
- OSIS book codes (`Gen`, `1Kgs`, `Ps`, `Song`, …) are used everywhere.

## Bible text and licensing (important: the owner requires full compliance)

- **ESV only via Crossway's official API, through the Cloudflare relay**
  (`https://bible-atlas-esv.justindrewadams.workers.dev`).
  - The key is a Cloudflare secret, `ESV_API_KEY`. It is never in the repo or the site. Do **not** build keys
    into the site.
  - The relay (`relay/esv-relay.js`, generated) only answers the app's origin, allows at most 500 verses or half a
    book per request, validates ranges, and sends `no-store`. To change it, edit `scripts/build-relay.mjs`, run
    `npm run build:relay`, and the owner re-pastes it into the Cloudflare dashboard.
  - If the ESV is unavailable, the app shows the WEB with a notice ("try again in a little while").
  - The app enforces the terms: `chapterPages()` splits long chapters; ESV is cached in memory only (≤ 500
    verses); the Crossway copyright notice and ESV.org link appear under ESV text.
- **Public domain** (bible-api.com): WEB, KJV, ASV, BBE, Darby, YLT, OEB.
- NASB, LSB, NKJV and HCSB are **not** allowed until the owner gets permission or uses API.Bible's free
  non-commercial plan through a relay. `OPEN_TRANSLATIONS` in `bible.ts` is the hook for freely licensed texts.
- **Hymns:** titles, writers and years only (facts, not copyrightable). **Never add lyrics.** No link-outs.
- **Nations, period and hymn-tie summaries** are original writing for this app.
- **Itiner-e** roads (CC BY 4.0) are credited in Sources & licenses (authors, paper, license, and that we clipped and
  simplified it) and in the distance panel. Approved by the owner in November 2026.
- **STEPBible** (CC BY 4.0) is credited in Sources & licenses and in the footer of every word-study card.
- Other attributions in Sources & licenses: Wikipedia (CC BY-SA, also on each place card), "Powered by Esri",
  OSM, DARE, Natural Earth, Theographic, OpenBible, Waldron's outline.
- Map: no CARTO. Esri tiles only up to the levels they cover (terrain native z9, upscaled to the z11 cap).
- **Ask the owner before any licensing-sensitive change** (new data source, new translation, anything quoted).

## Design conventions

- Flat, high-contrast style from a sample the owner supplied: thick black outlines, **square corners**, flat
  color blocks (sky `--sky`, blush `--blush`, leaf, sun `--sun`, flame), Figtree for the interface, EB Garamond
  for Bible text only (loaded in 400 and 600, so "bold" in Bible text is 600).
- `--select` is the light sky blue (`#cce8f8`; dark mode `#23506b`), used for the selected verse and hover states.
  The owner tried yellow, then chose blue.
- The top-left title is "BIBLE STUDY" / "COMPANION" on two lines of **equal width** (15.3px / 14.6px Figtree 800;
  re-measure if the font or letter-spacing changes). It is hidden on phones.
- **Header:** the full one-row header needs about 1440px. From 861 to 1439px, and on phones, the translation,
  journey and list selects plus the page buttons fold into the ☰ menu.
- **Phones must stay calm and uncluttered** (the owner asked for this explicitly): one-row header with ☰, thin
  lines, compact cards, no zoom buttons, map ≈36vh (46vh during a journey). Cards are a side panel on desktop and
  a bottom sheet on phones. Pages (Periods, People, Nations) share the `.periods-page` layout.
- The owner prefers **subtle** additions (e.g. the quiet Hymns button, the small last-mentioned dot).

## How to work on it (what has worked)

**On the owner's Mac (Claude desktop app, Code tab).** This is how recent sessions ran:
- There is usually **no local copy**: clone `https://github.com/justindrewadams/Bible-study-app.git` into the
  session folder. Pushing over HTTPS works with the owner's GitHub credentials.
- **Node.js is not installed** on the Mac. Download the official binary from nodejs.org into the session's
  scratchpad (e.g. `node-v22.11.0-darwin-arm64.tar.gz`), verify it against `SHASUMS256.txt`, put its `bin` on
  `PATH` for each command, then `npm ci`. Nothing gets installed system-wide.
- Preview with the app's built-in browser: a `.claude/launch.json` **in the session folder root** that runs
  `node <repo>/node_modules/vite/bin/vite.js preview <repo> --port 4173 --strictPort`.
- The network is open there: public-domain translations (WEB etc.) load for real. **The ESV relay refuses
  localhost**, so ESV can only be checked by the owner on the live site; say so plainly.
- When the browser pane is hidden, smooth scrolling doesn't run, so scroll-position tests give false failures.
  Screenshots can also lag a render; re-take before concluding something is broken.
- A big push (e.g. data files) may fail with "remote end hung up": run `git config http.postBuffer 524288000`
  and push again.

**In a cloud sandbox** (older sessions): Playwright is preinstalled (`require('playwright')`), but the network
blocks bible-api.com, api.esv.org, workers.dev, map tiles and Wikipedia; stub them with `page.route(...)`.

**Always:**
- Before pushing: `npx tsc && npx vite build` (and the `check:*` scripts if their data changed).
- Test desktop (1400–1440 wide) and phone (375–390 wide); check `document.documentElement.scrollWidth` for
  sideways overflow; check dark mode for color changes.
- Commit on `main` (end commit messages with the Co-Authored-By line), push, then confirm the GitHub Actions run
  succeeded. GitHub Pages lets browsers cache for ~10 minutes: if the owner "doesn't see" a change, check the live
  script contains it, then have them close and reopen the tab (or Cmd+Shift+R) rather than redeploying.
- The owner is **non-technical**: explain plainly, with clear next steps, and keep summaries short. They test on
  their phone and are happy for finished, checked work to go straight to the live site.

## Recently finished (November 2026)

Hymns for each chapter; rivers that thin out when zoomed out; flat-style verse highlight (now light blue) and
solid place-name underlines; bolded word for list items that share a verse (and the correct "N of M" chip);
quieter last-mentioned map marker; the Nations page with person-card links; the rename to Bible Study Companion
with the equal-width title and a header that folds into ☰ below 1440px; Hebrew & Greek word study; removal of the
personal ESV key field; site-wide search; the distance tool with Roman-road routes. Earlier: ESV via relay, the 17 periods, the People page with family trees, map clusters,
and the phone layout.

## Ideas not yet started (only if the owner asks)

- Hymn songbook numbers (e.g. *Songs of Faith and Praise*, *Praise for the Lord*) once the owner confirms them;
  owner may also add or remove hymns
- More nations (Perizzites, Girgashites, Horites, Gauls/Galatians) and owner corrections to nation summaries
- Waldron's exact scripture boundaries, once the owner provides them
- Linking place cards to their nation; a word-study search by Strong's number or English word (could join the
  site search)
- More translations through licensed channels
- Notes and highlights; offline use; more journeys and lists
