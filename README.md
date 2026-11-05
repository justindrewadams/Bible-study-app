# Bible Atlas

A Bible study app that puts the text and the map side by side.

- **Read in your translation.** KJV, WEB, ASV and other public-domain versions load with no setup. Modern versions (NIV, NKJV, NLT, NASB, ESV, CSB…) come from [bolls.life](https://bolls.life), and the official ESV API works with a free personal key.
- **Tap a verse to see where it happens.** Every place the verse names is pinned on the map with a popup. Place names in the text are highlighted, and you can tap one to jump to it. If a verse names no place, the map shows the **last place mentioned** (e.g. Acts 13:9 → Paphos, v. 6), which is usually where the story is.
- **Place info cards.** Tap a place name, a map pin's "About" button, or any dot on the map to open a card with: today's site and how certain it is, other biblical names and spellings, when it was established, a short history with a photo (from Wikipedia), key stories (hand-picked for about 75 major places), the journeys that stop there, and every verse that names it. Tap any reference to go to that verse.
- **Modern map overlay.** One toggle lays today's borders and city names over the ancient-style terrain, with an opacity slider. You can also switch to a full street map, satellite, or a Roman Empire map with ancient roads.
- **Follow a story with arrows.** Pick a journey and step through it stop by stop, or press **Play**. Arrows show the direction of travel, a marker animates along each leg, and the Bible text jumps to the verse for each stop. Tapping a numbered stop on the map works too.
  - Abraham's journey of faith
  - The Exodus & wilderness wanderings
  - The conquest of Canaan (Joshua)
  - The life & ministry of Jesus
  - Paul's 1st, 2nd and 3rd missionary journeys
  - Paul's voyage to Rome

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
| Key stories per place (hand-curated) | `scripts/place-stories.json` |
| Journeys (stops, verse refs, notes) | `scripts/journeys.source.json` → `src/data/journeys.json` |
| Bible text providers | `src/lib/bible.ts` |
| Map, overlays, arrows, animation | `src/components/MapView.tsx` |

### Add or edit a journey

Edit `scripts/journeys.source.json`. Each stop needs a `place` (the place name as OpenBible.info spells it), a `ref` (OSIS, e.g. `Acts.16.12`) and a `note`. Then run:

```bash
npm run build:data
```

The script looks up coordinates from the dataset, using the verse to tell apart places with the same name (Antioch in Syria vs. Pisidian Antioch, for example). It stops with an error if a stop can't be matched. For a spot the dataset doesn't have, set `lat`/`lon` on the stop yourself.

## Data & credits

- Places and verse links: [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data), CC BY 4.0. Many ancient sites are uncertain; pins show the most likely identification, and the popup says how certain it is.
- Place histories, photos and founding dates are loaded live from Wikipedia and Wikidata when available.
- Journey legs are straight lines between stops, not exact roads or sea routes. The order of some Gospel events is debated.
- Map tiles: Esri, OpenStreetMap contributors, and the [Digital Atlas of the Roman Empire](https://imperium.ahlfeldt.se/) (CC BY 4.0).
- Bible text: [bible-api.com](https://bible-api.com), [bolls.life](https://bolls.life), [ESV API](https://api.esv.org). Copyrighted translations are shown for personal study under each provider's terms.
