# Bible Study Companion

A Bible study app that puts the text and the map side by side.

- **Read in the ESV or a public-domain translation.** The ESV comes only from Crossway's official [ESV API](https://api.esv.org/), under its free non-commercial terms (see *Translations & licensing* below). WEB, KJV, ASV, BBE, Darby, YLT and OEB are public domain and come from [bible-api.com](https://bible-api.com).
- **Tap a verse to see where it happens.** Every place the verse names is pinned on the map with a popup. Place names in the text are highlighted, and you can tap one to jump to it. If a verse names no place, the map shows the **last place mentioned** (e.g. Acts 13:9 → Paphos, v. 6), which is usually where the story is.
- **Place info cards.** Tap a place name in the text, or any pin or dot on the map, to open a card with: today's site and how certain it is, other biblical names and spellings, when it was established, a short history with a photo (from Wikipedia), key stories (hand-picked for about 75 major places), the journeys that stop there, and every verse that names it. Tap any reference to go to that verse.
- **Study lists.** Step through a list the way you follow a journey, with Prev, Next or Play. The Bible text jumps to each item's verse, and the map pins its place when it has one. The 24 lists:
  - **Old Testament:** the days of Creation · the twelve sons of Jacob · the ten plagues · the Ten Commandments · the feasts of Israel · the judges · kings of the United Kingdom · kings of Israel and kings of Judah (with reign dates and whether each did good or evil) · the writing prophets
  - **Whole Bible:** women of the Bible
  - **New Testament:** the Twelve Apostles · miracles of Jesus · the seven signs in John · parables of Jesus · the "I Am" statements · the Beatitudes · the sayings from the cross · conversions in Acts · Paul's letters (when and where written) · the seven churches of Revelation · the Hall of Faith (Hebrews 11) · the fruit of the Spirit · the armor of God

  Lists are edited in `scripts/lists.source.json` and rebuilt with `npm run build:data`.
- **Periods of Bible history.** Bob and Sandra Waldron's 17 periods: Before the Flood, The Flood, Scattering of the People, Patriarchs, The Exodus, Wandering in the Wilderness, Invasion and Conquest, Judges, United Kingdom, Divided Kingdom, Judah Alone, The Captivity, Return from Captivity, Years of Silence, Life of Christ, The Early Church, and Letters to Christians. Open the **Periods** page (search and filter by testament) for a timeline and a short summary of each period, with its dates, key people, key events, the scriptures that belong to it, and its journeys. Every chapter is assigned to a period (see `src/data/periods.ts`), and the reader shows which one you're in.
- **People of the Bible.** Names are underlined in the text, and the verse bar lists who appears in each verse. Tap a name, or search the **People** page (about 3,000 people), to open a card with:
  - other names, tribe or group, and approximate dates
  - where they were born and died (tap to see the place)
  - the Bible period they belong to
  - a **family tree**: grandparents, parents, spouses, brothers and sisters, children and grandchildren. Tap anyone to move the tree to them. A list view is also available.
  - a biography from Easton's Bible Dictionary, with tappable verse references
  - every verse that names them

  Place cards list the people born or died there.
- **Modern map overlay.** One toggle lays today's borders and city names over the ancient-style terrain, with an opacity slider. You can also switch to a full street map, satellite, or a Roman Empire map with ancient roads.
- **Follow a story with arrows.** Pick a journey and step through it stop by stop, or press **Play**. Arrows show the direction of travel, a marker animates along each leg, and the Bible text jumps to the verse for each stop. Tapping a numbered stop on the map works too.
  - **Old Testament:** Abraham · Jacob · Joseph · the Exodus & wilderness · the conquest of Canaan · the travels of the Ark of the Covenant · David fleeing Saul · Elijah · the Exile to Babylon & the return
  - **New Testament:** the life & ministry of Jesus · Saul's conversion & early years · Paul's 1st, 2nd and 3rd missionary journeys · Paul's voyage to Rome
  - Long overland legs (to and from Haran and Babylon) follow the Fertile Crescent trade route rather than a straight line.

Works on desktop (side by side) and phone (map on top, text below). Your book, chapter, translation and map settings are remembered.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

### Use it on your phone

`.github/workflows/deploy.yml` publishes the app to GitHub Pages on every push to `main`. Turn it on once under **Settings → Pages → Source: GitHub Actions**. The app will then be at `https://<your-user>.github.io/<repo>/`, and on your phone you can "Add to Home Screen".

## How it works

| Piece | Where |
| --- | --- |
| Verse → place index (1,309 places, 8,647 verse links) | `public/data/` (generated) |
| Place cards: names, modern sites, all references | `public/data/place-details.json` (generated) |
| People index, details, verse links | `public/data/people*.json` (generated by `scripts/build-people.mjs`) |
| Key stories per place (hand-curated) | `scripts/place-stories.json` |
| Journeys (stops, verse refs, notes) | `scripts/journeys.source.json` → `src/data/journeys.json` |
| Bible text providers | `src/lib/bible.ts` |
| Map, overlays, arrows, animation | `src/components/MapView.tsx` |

### Add or edit a journey

Edit `scripts/journeys.source.json`. Each stop needs a `place` (the place name as OpenBible.info spells it), a `ref` (OSIS, e.g. `Acts.16.12`) and a `note`. Then run:

```bash
npm run build:data
```

The script looks up coordinates from the dataset, using the verse to tell apart places with the same name (Antioch in Syria vs. Pisidian Antioch, for example). It stops with an error if a stop can't be matched. For a spot the dataset doesn't have, set `lat`/`lon` on the stop yourself. Optional extras: `lookup` (a different verse to identify the place, when the stop's verse doesn't name it) and `via` (a list of `[lat, lon]` waypoints so the leg into that stop follows a route).

## Data & credits

- People, family links and dates: [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata), CC BY-SA 4.0. The derived files in `public/data/people*` and `public/data/place-people.json` are shared under the same license. Biographies come from Easton's Bible Dictionary (1897, public domain). Some people share a name, and dates are traditional estimates.
- Places and verse links: [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data), CC BY 4.0. Many ancient sites are uncertain; pins show the most likely identification, and the popup says how certain it is.
- Place histories, photos and founding dates are loaded live from Wikipedia and Wikidata when available.
- Journey legs are straight lines between stops, not exact roads or sea routes. The order of some Gospel events is debated.
- Map tiles: Esri, OpenStreetMap contributors, and the [Digital Atlas of the Roman Empire](https://imperium.ahlfeldt.se/) (CC BY 4.0). Lakes and rivers: [Natural Earth](https://www.naturalearthdata.com/) (public domain), built by `scripts/build-water.mjs`. The map stops at a regional close-up, which is enough to see the Sea of Galilee and the Jordan valley.
- Bible text: the ESV from Crossway's [ESV API](https://api.esv.org) (see below), and public-domain translations from [bible-api.com](https://bible-api.com).

## Translations & licensing

The app is free, with no ads and no donations, so it qualifies for each provider's free, non-commercial terms. It keeps to them as follows.

**ESV (Crossway).** The app uses only the official ESV API.
- It shows Crossway's copyright notice under ESV text, labels the text "ESV", and links to ESV.org.
- It never shows more than 500 verses, or half of a book, on screen at once. Short books such as Jude, Philemon and Obadiah are shown in two parts.
- It keeps no more than 500 ESV verses on the device, and only in memory (`src/lib/bible.ts`, `ESV_TERMS`).
- The API allows up to 5,000 requests a day, 1,000 an hour and 60 a minute. Passages already seen are reused from memory.

**ESV key.** The app reads the ESV through a small relay (a free Cloudflare Worker in [`relay/`](relay/README.md)) that holds the ESV API key as a Cloudflare secret. The key is never in this repository or the published site. The relay itself enforces Crossway's limits and doesn't cache ESV text. Setup takes about 10 minutes; see [relay/README.md](relay/README.md). Once it's running, put its address in `src/config.ts`. Readers can also add a personal key under **Settings** as a backup. If neither is available, the app shows the WEB and explains why.

**Everything else** is credited in the app under **Settings → Sources & licenses**.
- Public domain: the public-domain Bibles, Easton's Bible Dictionary and Natural Earth.
- CC BY 4.0: OpenBible.info places and the Digital Atlas of the Roman Empire.
- CC BY-SA 4.0: Theographic people data (this repository's derived people files carry the same license) and Wikipedia text, credited and linked on each place card.
- CC0: Wikidata.
- Esri and OpenStreetMap map tiles carry their attribution on the map.

