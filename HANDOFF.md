# Ancient Pathfinder: handoff notes

Read this first when picking the project back up. It records what exists, how it fits together,
the decisions already made (and why), and how the owner likes to work.

- **Live site:** https://ancientpathfinder.com/ (custom domain, bought November 2026; the old address
  https://justindrewadams.github.io/Bible-study-app/ redirects there once the domain is set in Settings → Pages).
  GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main`, in about 1 minute.
  The domain is set in the repo's Settings → Pages (no CNAME file: an Actions deploy ignores one).
- **Repo:** `justindrewadams/Bible-study-app`, branch `main`
- **Name:** **Ancient Pathfinder** (from Jeremiah 6:16, "ask for the ancient paths"; renamed November 2026 from
  "Bible Study Companion", which was earlier "Bible Atlas"). The repo name and the relay's Cloudflare name
  (`bible-atlas-esv`) were deliberately **kept**. The relay only answers the sites in its `ALLOWED_ORIGINS`
  (ancientpathfinder.com, www.ancientpathfinder.com and justindrewadams.github.io), so a new address must be
  added there first or the ESV stops loading.
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
5. **Journeys** (15): animated stop-by-stop routes (Abraham, Exodus, Paul's journeys, and more). Once the road
   network loads, land legs follow Roman-era roads (Itiner-e) when a road joins the stops within 1.6× the drawn
   length (+5 mi); legs marked `sea: true` (boat, incl. the Sea of Galilee), legs with hand-traced `via` points, and
   journeys with `roads: false` (the Exodus) are drawn as before. The journey panel shows "N miles from <last stop>
   by road · about N days on foot" / "by sea" / "along the usual route" / "as the crow flies". Code: `journeyLegs()`
   in `lib/roads.ts`, `useJourneyLegs` in `JourneyPanel.tsx`; sea legs were set from Acts and the Gospels.
6. **Study lists** (29, including Baptisms in the New Testament and False Gods and Idols), stepped through like journeys: kings, judges, prophets, apostles, miracles, parables,
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
   **Nations in the text:** people-group words ("Philistines", "Egyptians", "Romans", "Jews", "Hebrews") get a green
   underline and open a **nation card** (side panel / bottom sheet, green head, like the person card: where, origin
   with the family line, history, key verses, "Open on the Nations page"). Country words that are usually places or
   people (Egypt, Moab, Babylon…) only appear in the blue verse bar's "Nations:" row. Bare "Israel"/"Judah" are left
   out (too common, and also Jacob and his son). Word lists: `src/lib/nationMentions.ts`; card: `NationCard.tsx`.
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
    result. **Verses** (owner-approved November 2026): a phrase of 2+ words also searches
    Bible wording and shows the **3 best** verses, in the translation being read, labelled "Exact phrase", "All your
    words", "Most of your words" or "Same Hebrew/Greek words", with the match in bold. How it works, so it suits any
    future translation (licensed texts can't be stored on the device): (1) find ~6 candidates on the device from the
    public-domain **WEB** text (`public/data/search/web.json`: loose matching via `lib/stem.ts`, word forms, small
    typos, missing/reordered words; "Yahweh/Jehovah" = "LORD") and the **Hebrew/Greek index**
    (`orig.json`: Strong's numbers per verse + English words that usually render them, from STEPBible data);
    (2) fetch just those verses in the reader's translation with `fetchVerses()` in `bible.ts` (ESV: one request to
    the relay's `/verses`, max 6, through the memory-only ESV cache; bible-api: one request per book), score again,
    keep results within 60% of the best. If the translation can't be fetched, snippets fall back to WEB and say "WEB".
    ESV snippets carry the Crossway notice under the section. Data (~1.9 MB gzipped) loads on the first phrase
    search; rebuild with `npm run build:verse-search`. Code: `lib/verseSearch.ts`. Code: `src/lib/search.ts` (index, matching, ranking) and `components/SiteSearch.tsx`. Its styles use `ss-`/`search-` names
    (`.ss-box`), **not** `.search-box`, which belongs to the People/Nations/Periods page search boxes.
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
13. **Text size:** a quiet "AA" button beside Hymns opens a small pop-up: A−/A+ through five sizes of the Bible
    text (×1 to ×1.6, `TEXT_SIZES` in `Reader.tsx`, via `--text-scale` on `.verses`) and a "Bolder text" box (EB
    Garamond 500; place names and list words 700). Saved on the device as `textPrefs`.
14. **NASB 1995, CSB and NKJV** (owner-approved November 2026) from **API.Bible's free Starter plan**, through the
    same relay (`/abible?bible=CSB&book=John&chapter=3`). See the licensing section below.
15. **Sources & licenses** pop-up (the ⚙ button): lists every source and license. The personal ESV key field was
    **removed** at the owner's request (a key saved by an older version is still used quietly as a backup).
16. **Accounts (Stage 1, built November 2026; off until set up)**: optional sign-in that syncs reading
    preferences (translation, text size/bolder text, map style) and **bookmarks** (references only, "☆ Save" beside
    HEBREW/GREEK in the blue verse bar, listed on the account page). A person icon beside ⚙ ("Sign in" / "Your
    account" in the ☰ menu) opens one pop-up (bottom sheet on phones) for sign-in, create account, forgot password,
    and the account page (passkeys, change password/email/display name, sign out / everywhere, download my data,
    delete my account). **Privacy & terms** page at `#privacy` (linked from sign-up, the account page and Sources &
    licenses). Emailed links arrive as `#account/verify|reset|email/<code>`; the app removes the code from the
    address bar at once. Everything is behind `ACCOUNTS_LIVE` in `config.ts` (**on** since 24 Nov 2026); while off, nothing appears and the account service is never contacted. Even when on,
    the service is contacted only after someone opens the pop-up or this device has signed in before (`acct` flag).
    See **Accounts** below.

**Added for the owner's Passion Week class (November 2026):**
- **Passion Week journey** (`passion` in `journeys.source.json`, 38 stops): follows the whole day-by-day timeline,
  one stop per event, from Jericho to the empty tomb (Bethany each night, the temple each day). Stops may carry
  **`day`** and **`event`** (shown as "SUNDAY · The triumphal entry" in the panel; the All stops list is grouped by
  day). Walks in and around the city have hand-drawn `via` routes (down the Mount of Olives, out by Siloam and up
  the Kidron…), and the Jericho leg traces Itiner-e's road but turns off to Bethany (the network runs on into the
  city). Spots that aren't places in the data ("The temple", "The upper room", "The road from Bethany", "The Kidron
  Valley"…) have approximate lat/lon, and the journey panel links them to the Jerusalem page (`SPOT_PLACES`).
  Short legs are shown in minutes on foot. Regenerated by the scratch script `class/add_class_data.py` (writes the
  source and generated JSON directly); `build-data.mjs` carries the extra fields through.
- **City close-up** (`CityPlanLayer.tsx`): inside `CITY_BOUNDS` (Jerusalem, the Mount of Olives, Bethany) the map
  may zoom to 16 instead of 11 (`setMaxZoom` on moveend), and from zoom 12 the first-century city is drawn on the map:
  walls, valleys, the temple platform, Antonia, Herod's palace, pools, with names that open the Jerusalem page.
  Original, approximate drawing. Journey camera: each leg is framed (`flyToBounds`) clear of the journey card
  (`journeyPanelRoom`: bottom or left, whichever hides less), up to zoom 16 for legs inside the city and 11 elsewhere;
  another event at the same spot leaves the view alone. Stops at the same spot share one numbered square.
- **Lists:** "Prophecies Fulfilled in Passion Week", "Christ Our
  Passover Lamb", "Rulers in Luke 3:1–2". List items may have an **`area`** (outlines of [lat, lon]) that the map
  shades in the list's color (`AreaLayer` in `MapView.tsx`); the rulers' territories are approximate, drawn here.
- **Compare the accounts** (`src/data/parallels.ts`, `CompareGospels.tsx`): when a selected verse is in a parallel
  set, a chip "⇄ Compare the accounts: …" opens the passages side by side (tabs on phones) in the reader's
  translation, each fetched like a reader page (ESV limits hold). The table is original: John's ministry and
  Passion Week so far (33 events); add more sets the same way (passages within one chapter each).
  It has the same "AA" text size / Bolder text control as the reader (`TextSizeControl.tsx`, one shared setting,
  `useTextPrefs`, saved as `textPrefs`), and each account scrolls on its own (side by side on computers; on phones
  each tab keeps its own place).
  **Presenting** there too: "⛶ Present" in its header (computers only) fills the screen with larger text, and
  → PageDown Space / ← PageUp step to the next / previous event in `PARALLELS` order (↑ ↓ still scroll an account).
  Esc ends presenting, a second Esc closes the comparison. Opened while the app is presenting, it starts presenting,
  and the app's own stepping pauses while it is open.
- **Jerusalem in Jesus' Day** (`#jerusalem`, `#jerusalem/<spot>`; `JerusalemPage.tsx`, `src/data/jerusalem.ts`):
  an SVG city plan and temple plan drawn for the app, with 27 tappable spots (text + verses). Reached from place
  cards (`PLACE_TO_SPOT`), journey stops and the site search ("Jerusalem in Jesus' day" results). No header button
  (the 1440px header is full).
- **Herod family:** `scripts/people-corrections.json` (merged by `build-people.mjs`, and already applied to the
  committed people data) links Agrippa I, his children and Herodias, and adds other names (Herod the Great, Herod II,
  Philip the tetrarch, Herod Agrippa II). `HerodDynasty.tsx` draws the dynasty on those people's cards.
- The hymn "Night, with Ebon Pinion" (L. H. Jameson) was already tied to Gethsemane.
- The "Passion Week, Day by Day" list was **removed** at the owner's request (November 2026): the journey covers the
  same 34 events, so the two only doubled up. Its note that the Gospels don't date every event moved into the
  journey's summary.
- **Journey and list menus on computers** (`PickerSelect.tsx`): the real `<select>` stays (its look, phones, focus),
  but with a mouse on a wide screen the app draws its own menu below the box: full height, the chosen item ticked and
  scrolled to the middle, ↑ ↓ Enter Esc. (A Mac's own menu lines the chosen item up with the box, which pushed the
  menu off the top of the screen when the chosen journey was near the end.) Phones and tablets keep the system
  picker.
- **Presenting mode** (for a TV or projector): "⛶ Present" beside Hymns in the chapter heading (hidden under 860px).
  Asks for full screen (carries on without it where a browser refuses), hides the top bar and chapter buttons, makes
  the text ~1.45× larger and the map wider, and shows a slim bar ("‹ Passion Week · stop 6 of 38 ›", Finish
  presenting). → ↓ PageDown Space Enter step forward, ← ↑ PageUp Backspace step back (clickers send PageDown/PageUp);
  it steps the open journey, else the open study list, else the chapter verse by verse (on to the next chapter at
  the end). Esc (or leaving full screen) ends it; with a card or pop-up open, Esc closes that first. Keys are taken
  in the capture phase so the map doesn't pan. Code: `presentStep`/`startPresenting` in `App.tsx`, `.presenting`
  styles.

## Accounts

Owner's decisions (November 2026): **email required** (confirmed at sign-up, used only for confirm/reset/security
notices); **password + optional passkey**; **Brevo** (free) sends email; reset links last **15 minutes**; Turnstile
on account forms; Have I Been Pwned refuses leaked passwords; domain settings moved from Namecheap to Cloudflare so
the service can live at `account.ancientpathfinder.com` (first-party cookie). The owner asked for "the safest
possible version": keep it that way.

- **Service:** `accounts/` (separate Worker `ancientpathfinder-accounts` + D1 `ancientpathfinder-accounts`; not the
  relay). Setup, security table, local testing and the incident checklist: `accounts/README.md`. Build:
  `npm run build:accounts` → `accounts/accounts-worker.js` (minified, pasted into the dashboard like the relay);
  type-check: `npm run check:accounts`. Secrets: `DATA_KEY` (never change it), `TURNSTILE_SECRET`, `BREVO_API_KEY`.
- **Sign-in is by username** (email is for resets; the reset email also reminds people of their username), because
  the password is stretched in the browser with the username as salt (Cloudflare's free plan can't afford slow
  hashing on the server). Usernames therefore can't change.
- **Licensing:** bookmarks/labels/preferences only; never store or email Bible wording. Notes, custom journeys/lists
  and lessons (Stages 2–4) must follow the same rule: references, and the person's own words; warn on pasted
  licensed text. The terms on the Privacy page already say so.
- **Privacy page** (`PrivacyPage.tsx`) must stay true to what the service does; update its date when changed.
  `PRIVACY_CONTACT` in `config.ts` (empty = hidden) is for a contact address once the owner picks one.
- **Testing locally:** wrangler 4 needs Node ≥ 22.12 (22.21.1 worked). `wrangler dev` with `DEV=1` (localhost only)
  writes emails to `GET /dev/outbox`. Build the app with `VITE_ACCOUNTS_URL=http://localhost:8787` and Turnstile's
  test site key `1x00000000000000000000AA`. Rate limits persist in the local D1: clear with `DELETE FROM rate`.
  Passkeys can be tested with a small software authenticator (ES256, "none" attestation, CBOR by hand); the
  built-in browser pane has no platform authenticator.
- **Setup done (24 Nov 2026):** DNS moved to Cloudflare (nameservers eugene/fish; Namecheap still the registrar;
  its old records left in place unused). GitHub's A/AAAA/www records must stay **DNS only** (grey); they were found
  orange once after Brevo's setup and switched back. `account` is a Worker custom domain (orange, correct). Brevo
  free plan (300/day, may add a "Sent with Brevo" footer); domain authenticated (brevo-code TXT, brevo1/brevo2 DKIM
  CNAMEs, `_dmarc` p=none). D1 console joins pasted lines, so `schema.sql` uses /* */ comments only.
- **Stage 2, notes and notebooks (built 24 Nov 2026):** owner's choices: notes on a verse **or range**, automatic
  verse links (a must), simple formatting with the buttons behind an "Aa" toggle on phones, 5,000 characters per
  verse note and 20,000 per page, **notebook → folder → page** (folders don't nest further), notes **hidden while
  presenting** with a "Show my notes" switch, licensed wording **blocked** (not just warned), notes **encrypted on
  the server** (not device-only, which would lose notes on a password reset).
  - Service: `accounts/src/notes.ts` (routes `/notebooks…`, `/notes…`), tables `notebooks` and `notes` in `schema.sql`.
  - App: `lib/notes.ts` (store, loaded after sign-in, forgotten on sign-out), `lib/refs.ts` (finding references in
    text; short abbreviations that are also words, like "He" or "Am", are left out), `lib/licenseGuard.ts` (8-word
    runs matching licensed text in memory, newest chapter first, allowed if also in the KJV/WEB; offers "Use the
    reference" / KJV / WEB wording), `components/NoteText.tsx` (Markdown subset drawn as React elements, never
    HTML), `NoteEditor.tsx` (saves 1.5 s after typing stops; version conflicts offer newer copy / keep mine),
    `VerseNotes.tsx` (from "✎ Note" in the verse bar or the ✎ mark by a verse number), `NotesPage.tsx` (`#notes`,
    `#notes/nb/<id>`, `#notes/page/<id>`, `#notes/verse`). "Download my data" adds notes in the app.
  - Header: "Notes" sits before Periods; at 1440–1599px the selects and page buttons are a little narrower so the
    one-row header still fits (the Stage 1 account icon had already made it 8px too wide at 1440).
  - `lib/lazyPart.tsx`: on-demand parts reload the page once if a new version removed their file, and a crash in
    one part shows "Something went wrong" instead of blanking the app.
  - Testing the guard locally: override `window.fetch` for `/abible?` with placeholder wording (the relay refuses
    localhost), as for Stage 1.
- **Stage 3, your own journeys and lists (built and live 24 Nov 2026):** owner's choices: made and edited on the Notes page
  ("My journeys" / "My lists" beside the notebooks) **and** shown at the top of the journey and list menus under
  "My journeys" / "My lists"; a stop is a Bible place **or any spot tapped on a small map**; routes follow **Roman
  roads, with a "by boat" option** per stop; **"Make my own copy"** of any built-in journey or list.
  - Stored as notes (`kind: "journey" | "list"`, `stops` / `items`, `color`, `summary`, `from`); the service checks
    each field (`readStop` in `accounts/src/notes.ts`). Request size limit raised to 400 KB.
  - `lib/mine.ts` turns them into ordinary `Journey` / `StudyList` objects (ids `my:<noteId>`) and registers them
    (`setMyJourneys` / `setMyLists`; `allJourneys()` / `allLists()` replace `JOURNEYS` / `LISTS` where the app looks
    one up), so the map, panels, Roman-road legs and presenting work unchanged. Built-in lists only (`LISTS`) still
    feed the Periods page and site search.
  - `components/MineEditor.tsx`: title, colour, description, stops with ▲▼, place search over the ~1,300 places,
    a small Leaflet map to tap a spot (terrain + faint modern labels, for finding places), day/event, "reached by
    boat", word to bold (lists). Incomplete stops (no place or verse) aren't saved until complete. Licensed wording
    is blocked per field. The journey and list panels show "Make my own copy" (built-in) or "Edit" (yours).
  - Switch: `MINE_LIVE` in `config.ts` (needs the re-pasted Worker; no new tables).
- **Renamed and preferences (24 Nov 2026):** the Notes page is called **"My Content"** in the header, ☰ menu and
  page title (code and address still say `notes` / `#notes`). The account page starts with a **Preferences**
  section (`components/Preferences.tsx`, passed in from App): text size A−/A+ with a KJV sample line, Bolder text,
  translation, map style, modern map on top, ancient region names, all chapter places. Same settings as the AA
  button, translation menu and map layers; synced to the account. At 1440–1599px the header's page buttons are
  tighter (7px padding, no letter-spacing) and the menus a little narrower so "My Content" still fits one row.
- **Stage 4, class lessons (built and live 24 Nov 2026):** owner's choices: **anyone with an account can share** by link,
  links are **live** (always the latest), six kinds of step (passage, notes, map stop, journey/list from a chosen
  stop, page: person/nation/period/Jerusalem spot, web link), "follow along" (phones following the presenter)
  **later**. The owner asked for a **disclaimer** when a shared lesson opens (`DISCLAIMER` in
  `components/LessonPanel.tsx`, shown in `LessonIntro` before it starts, and as a short "Made by a user · please
  check it with Scripture" line on the panel). Because anyone can share: "Report this lesson" (emails the
  administrators) and an administrator-only "Remove"; the author's name only if they tick "Show my display name".
  - Service: `accounts/src/lessons.ts` (share/unshare, `GET /shared`, report, remove), `readStep` in `notes.ts`,
    table `shares`, plain variable `ADMIN_USERNAMES` on the Worker (the owner's username). Tests: `lesson-test.mjs`.
  - App: `lib/lessons.ts` (shares store, opening a shared lesson and registering its journeys/lists as `shared:<id>`,
    "Save a copy"), `components/LessonEditor.tsx` (in My Content: "My lessons"; steps with ▲▼; Share box),
    `components/LessonPanel.tsx` (player, intro/disclaimer, report form), `goLessonStep` / `lessonAction` in
    `App.tsx` (each step moves the reader/map; presenting steps the lesson first). Links: `#lesson/<22-char code>`;
    the app takes the code out of the address bar once opened.
  - Switch: `LESSONS_LIVE` in `config.ts`.
- **Possible next:** "follow along" (class phones follow the presenter's steps live), and the "Road to AD 70"
  timeline from the class brainstorm.

## Stack and layout

- Vite + React 18 + TypeScript, react-leaflet 4. No backend except the ESV relay. `npm run dev` / `npm run build`.
- **Opening chapter:** the app always opens at **Genesis 1** (owner's choice, November 2026); the chapter is not
  remembered between visits (the translation and text size still are).
- `src/App.tsx`: app state and layout: header, ☰ menu, hash routes (`#periods`, `#people`, `#nations`), the
  Sources & licenses pop-up, and all wiring. **Only one card at a time** (place, person, nation or word study).
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
| `npm run build:verse-search` → `build-verse-search.mjs` | World English Bible (eBible.org 2020 stable text, public domain, unchanged) + the STEPBible word data above | `public/data/search/web.json`, `orig.json` |
| `npm run build:roads` → `build-roads.mjs` | Itiner-e static version 2024 (CC BY 4.0, zenodo.org/records/17122148) | `public/data/roads.json` (Bible lands + Mediterranean, simplified, road ends joined into a network) |
| `npm run build:words` | STEPBible TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC (CC BY 4.0) | `public/data/words/<Book>/<chapter>.json`, `lexicon/<H\|G><n>.json`, `grammar-H.json`, `grammar-G.json` |

Checks (Node 22.6+): `npm run check:hymns` and `npm run check:nations` validate every reference and person slug.

- **Journeys and lists:** edit the `*.source.json` files. Each item has `place`, `ref` (OSIS, e.g. `Acts.16.12`)
  and a `note`. Optional: `lookup`, `lat`/`lon`, `via`, `sea` (journey stop reached by boat), `meta`, `tag`, and `words` (when items share a verse:
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
    book per request (`/passage`) or 6 single verses (`/verses`, for verse search), validates ranges, and sends
    `no-store`. To change it, edit `scripts/build-relay.mjs`, run
    `npm run build:relay`, and the owner re-pastes it into the Cloudflare dashboard.
  - If the ESV is unavailable, the app shows the WEB with a notice ("try again in a little while").
  - The app enforces the terms: `chapterPages()` splits long chapters; ESV is cached in memory only (≤ 500
    verses); the Crossway copyright notice and ESV.org link appear under ESV text.
- **Public domain** (bible-api.com): WEB, KJV, ASV, BBE, Darby, YLT, OEB. The WEB text is also bundled for verse
  search (eBible.org; "World English Bible" is their trademark for the unchanged text, so keep it unchanged).
- **NASB 1995, CSB, NKJV via API.Bible** (free Starter plan, non-commercial; terms read November 2026 at
  api.bible/terms-and-conditions and care.api.bible articles 401 and 405). `APIBIBLE_TRANSLATIONS` in `bible.ts`,
  offered only while `APIBIBLE_ENABLED` in `config.ts` is true; relay route `/abible` in `scripts/build-relay.mjs`.
  **Status (24 Nov 2026): live.** The owner's API.Bible Starter account has NASB1995, CSB and NKJV; the Worker has the
  `API_BIBLE_KEY` secret and the `ABIBLE_STORE` binding to the KV namespace `abible-chapters`; checked on the live site.
  The owner chose *not* to email API.Bible about re-reporting cached FUMS tokens for now.
  **Text format:** the relay asks for API.Bible's **HTML**, not plain text: plain text turns the small-capitals
  divine name into "Lord". `abibleVerses()` (a real function in `build-relay.mjs`, inserted with `toString()` so its
  regexes need no template escaping) turns verse spans (`class="v"`) into verse breaks and prints small-caps spans
  in capitals: the CSB marks LORD `nd`, the NASB 1995 and NKJV `L<span class="sc">ord</span>` (the NASB's Old
  Testament quotations are also `sc`, so they appear in capitals, as in print). Other tags (italics `it`, words of
  Jesus `wj`, poetry `q1`…) are dropped, paragraphs become spaces. Each response also lists the chapter's class
  names as `marks` (no text), for checking new formatting. Stored chapters use keys `ch3:<code>:<osis>.<chapter>`;
  changing the parsing means bumping that prefix (old keys simply expire). After any relay change the owner must
  re-paste `relay/esv-relay.js` into the Worker editor.
  **Checking from the Mac:** the relay checks only the `Origin` header, so
  `curl -H "Origin: https://ancientpathfinder.com" "https://bible-atlas-esv.justindrewadams.workers.dev/abible?bible=CSB&book=Ps&chapter=117"`
  works (each new chapter spends one of the monthly calls; Ps 117 and Matt 4 are already stored). Print verse
  numbers, `marks` and whether "LORD" appears; don't paste whole chapters of licensed text into the conversation.
  What the terms require and how we meet them:
  - **5,000 calls a month, 3 copyrighted Bibles** (all three slots used; no room for a fourth on this plan).
    The relay keeps each chapter in Cloudflare KV (`ABIBLE_STORE`), refetches after **25 days**, never serves
    one **30+ days** old (KV expires it then). The terms' rule is *refresh at least every 30 days*, not delete.
    3 × 1,189 chapters = 3,567, so even if every chapter were read the 25-day refresh stays under 5,000. A
    counter (KV key `usage`, per day, summed over 31 days) stops calls at 4,500; if the counter can't be saved
    the call is refused. Verse search reads whole chapters through the same store (no extra calls).
  - **FUMS usage tracking is required for web apps**: each chapter keeps its `fumsToken`, and the app calls
    `fums("trackView", token)` every time it is shown (`reportView()` in `bible.ts`, loads
    `pkg.api.bible/fumsV3.min.js` on first use). Whether a cached token may be re-reported isn't stated in their
    docs; the owner may confirm with support@api.bible.
  - **Credit**: the copyright notice API.Bible sends when it is a full one (80+ characters: the NASB's), otherwise
    the publisher's standard notice in `APIBIBLE_TRANSLATIONS` (API.Bible sends only "© 2017 Holman Bible
    Publishers" for the CSB, which lacks the required trademark line, and a short line for the NKJV); "Text provided by API.Bible" with a link (required on Starter), and "Copyright details"
    opening Sources & licenses, which lists every notice and explains the caching and tracking. No logos.
  - **Unchanged text** (no footnotes or headings, which their API offers as options); kept **in memory only** on the
    device (≤ 500 verses); **printing stops at 100 verses** (`body.print-limit`, their DRM rule).
  - **NKJV**: only while the app has under 5,000 users a month (the range set in the API.Bible account).
  - **Never**: ads/fees/donations (would need a paid plan), sending this text to AI tools or AI text-to-speech,
    or putting it in emails/push messages (matters for "class lessons": share references, not wording).
  - **Removal**: 24 hours after a request, 72 hours after the plan ends: set `API_BIBLE_OFF` and delete the KV
    namespace (relay/README.md).
  - The relay refuses localhost, so these translations can only be checked on the live site; locally the app
    falls back to the WEB with a notice.
- LSB and HCSB are **not** allowed until the owner gets permission. `OPEN_TRANSLATIONS` in `bible.ts` is the hook
  for freely licensed texts.
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
  for Bible text only (loaded in 400, 500, 600 and 700; "bold" in Bible text is 600, 700 with Bolder text).
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
- The network is open there: public-domain translations (WEB etc.) load for real. **The relay refuses
  localhost**, so the ESV, NASB 1995, CSB and NKJV don't load in a local preview (the ESV shows "Couldn't load this
  chapter"; the API.Bible ones fall back to the WEB). To test their screens locally, override `window.fetch` in the
  page for `/abible?` with placeholder wording. To see them for real, open https://ancientpathfinder.com/ in the
  built-in browser (it works there) or use the curl check above.
- **`gh` (GitHub CLI) is not installed.** Check the deploy with the public API instead:
  `curl -s "https://api.github.com/repos/justindrewadams/Bible-study-app/actions/runs?branch=main&per_page=1"`
  and read `status`, `conclusion` and `head_sha` of the first run.
- The shell's working folder can change between commands; use absolute paths (a small `env.sh` in the scratchpad
  that sets `PATH` and `cd`s into the repo worked well).
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
with the equal-width title (then to Ancient Pathfinder with the ancientpathfinder.com domain) and a header that folds into ☰ below 1440px; Hebrew & Greek word study; removal of the
personal ESV key field; site-wide search; the distance tool with Roman-road routes; journeys along Roman roads; nation cards from the text; always opening at Genesis 1; verse search by wording and meaning; Passion Week class tools (journey, lists, Compare the accounts, Jerusalem page, Herod's dynasty); NASB 1995, CSB and NKJV through API.Bible; accounts Stage 1 (live 24 Nov 2026: Cloudflare DNS, Worker, D1, Turnstile and Brevo free plan set up); notes and notebooks (Stage 2, live 24 Nov 2026). Earlier: ESV via relay, the 17 periods, the People page with family trees, map clusters,
and the phone layout.

## Ideas not yet started (only if the owner asks)

- From the Passion Week class brainstorm: a **"Road to AD 70" timeline**, and **class lessons** (verses, notes, map
  stops and links bundled into one shareable link; licensed wording must not be put in the link or sent by email).
  Class lessons are now planned as **Stage 4 of accounts** (see Accounts).

- Hymn songbook numbers (e.g. *Songs of Faith and Praise*, *Praise for the Lord*) once the owner confirms them;
  owner may also add or remove hymns
- More nations (Perizzites, Girgashites, Horites, Gauls/Galatians) and owner corrections to nation summaries
- Waldron's exact scripture boundaries, once the owner provides them
- Linking place cards to their nation; a word-study search by Strong's number or English word (could join the
  site search)
- More translations through licensed channels (API.Bible's free plan is full at three)
- Notes and highlights; offline use; more journeys and lists
