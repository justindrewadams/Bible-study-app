import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOOKS, getBook } from './data/books';
import {
  BIBLE_API_TRANSLATIONS,
  ESV_TRANSLATION,
  fetchChapter,
  findTranslation,
  loadBollsTranslations,
  type Translation,
  type Verse,
} from './lib/bible';
import { loadChapterGeo, placesForVerse, type ChapterGeo, type Place } from './lib/geo';
import { JOURNEYS, parseRef, type Journey } from './lib/journeys';
import { usePersistentState } from './lib/usePersistentState';
import MapView, { DEFAULT_MAP_SETTINGS, type MapFocus, type MapSettings } from './components/MapView';
import MapControls from './components/MapControls';
import Reader from './components/Reader';
import JourneyPanel from './components/JourneyPanel';
import PlaceCard from './components/PlaceCard';
import { loadPlaces } from './lib/geo';
import PeriodsPage from './components/PeriodsPage';
import ListPanel from './components/ListPanel';
import { LISTS, LIST_GROUPS, type StudyList } from './lib/lists';
import { periodFor } from './data/periods';

interface Location {
  book: string;
  chapter: number;
}

const formatRef = (bookName: string, chapter: number, verse: number) => `${bookName} ${chapter}:${verse}`;

export default function App() {
  const [loc, setLoc] = usePersistentState<Location>('loc', { book: 'Acts', chapter: 13 });
  const [translationId, setTranslationId] = usePersistentState('translation', 'bibleapi:kjv');
  const [esvKey, setEsvKey] = usePersistentState('esvKey', '');
  const [mapSettings, setMapSettings] = usePersistentState<MapSettings>('map', DEFAULT_MAP_SETTINGS);
  const [mapVisible, setMapVisible] = usePersistentState('mapVisible', true);

  const [bolls, setBolls] = useState<Translation[]>([]);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<ChapterGeo | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [placeOverride, setPlaceOverride] = useState<Place | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [stopIndex, setStopIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardPlace, setCardPlace] = useState<Place | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [listIndex, setListIndex] = useState(0);
  const [listPlaying, setListPlaying] = useState(false);
  const studyList = LISTS.find((l) => l.id === listId) ?? null;
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // "#periods" or "#periods/<id>" shows the periods page (so the back button works)
  const periodsOpen = hash.startsWith('#periods');
  const periodFocus = periodsOpen ? (hash.split('/')[1] ?? null) : null;
  const openPeriods = (id?: string) => {
    window.location.hash = id ? `periods/${id}` : 'periods';
  };
  const closePeriods = () => {
    history.pushState(null, '', window.location.pathname + window.location.search);
    setHash('');
  };

  const book = getBook(loc.book);
  const currentPeriod = periodFor(loc.book, loc.chapter);
  const translation = findTranslation(translationId, bolls);
  const journey = JOURNEYS.find((j) => j.id === journeyId) ?? null;

  useEffect(() => {
    loadBollsTranslations().then(setBolls);
  }, []);

  // Load chapter text
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchChapter(translation, loc.book, loc.chapter, { esvKey })
      .then((v) => !cancelled && setVerses(v))
      .catch((e: Error) => !cancelled && (setError(e.message), setVerses(null)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [translation.id, loc.book, loc.chapter, esvKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chapter geography
  useEffect(() => {
    let cancelled = false;
    setGeo(null);
    loadChapterGeo(loc.book, loc.chapter).then((g) => !cancelled && setGeo(g));
    return () => {
      cancelled = true;
    };
  }, [loc.book, loc.chapter]);

  const goTo = useCallback(
    (book: string, chapter: number, verse: number | null = null) => {
      setLoc({ book, chapter });
      setSelectedVerse(verse);
      setPlaceOverride(null);
    },
    [setLoc],
  );

  const goToStop = useCallback(
    (j: Journey, i: number) => {
      const r = parseRef(j.stops[i].ref);
      setJourneyId(j.id);
      setStopIndex(i);
      goTo(r.book, r.chapter, r.verse);
    },
    [goTo],
  );

  const isNarrow = () => window.matchMedia('(max-width: 860px)').matches;

  /** Jump to a verse from the place card, keeping that place pinned on the map. */
  const goToRefForPlace = (ref: string, place: Place) => {
    const r = parseRef(ref);
    goTo(r.book, r.chapter, r.verse);
    setPlaceOverride(place);
    if (isNarrow()) setCardPlace(null);
  };

  const openPlaceIndex = (index: number) => loadPlaces().then((ps) => setCardPlace(ps[index]));

  /** Jump to a list item's verse and pin its place (if it has one) on the map. */
  const goToListItem = useCallback(
    (l: StudyList, i: number) => {
      const item = l.items[i];
      const r = parseRef(item.ref);
      setListId(l.id);
      setListIndex(i);
      goTo(r.book, r.chapter, r.verse);
      if (item.placeIndex != null) loadPlaces().then((ps) => setPlaceOverride(ps[item.placeIndex!]));
      else if (item.lat != null && item.lon != null)
        setPlaceOverride({ index: -1, name: item.place ?? item.t, lat: item.lat, lon: item.lon!, type: 'region', confidence: 50 });
    },
    [goTo],
  );

  // List autoplay
  useEffect(() => {
    if (!listPlaying || !studyList) return;
    if (listIndex >= studyList.items.length - 1) {
      setListPlaying(false);
      return;
    }
    const t = setTimeout(() => goToListItem(studyList, listIndex + 1), 4000);
    return () => clearTimeout(t);
  }, [listPlaying, studyList, listIndex, goToListItem]);

  const openList = (id: string, i = 0) => {
    const l = LISTS.find((x) => x.id === id);
    setListPlaying(false);
    if (l) goToListItem(l, i);
    else setListId(null);
  };

  // Journey autoplay
  useEffect(() => {
    if (!playing || !journey) return;
    if (stopIndex >= journey.stops.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => goToStop(journey, stopIndex + 1), 3200);
    return () => clearTimeout(t);
  }, [playing, journey, stopIndex, goToStop]);

  const focus: MapFocus | null = useMemo(() => {
    if (selectedVerse == null || !geo) return null;
    const label = formatRef(book.name, loc.chapter, selectedVerse);
    if (placeOverride) return { places: [placeOverride], inferred: false, label };
    // While following a journey, the journey marker already shows where we are.
    if (journey && journey.stops[stopIndex]?.ref === `${loc.book}.${loc.chapter}.${selectedVerse}`) return null;
    const r = placesForVerse(geo, loc.chapter, selectedVerse);
    if (!r.places.length) return null;
    return { places: r.places, inferred: r.inferred, label };
  }, [selectedVerse, geo, placeOverride, book.name, loc, journey, stopIndex]);

  const selectedInfo = useMemo(() => {
    if (selectedVerse == null || !geo) return null;
    // a place chosen explicitly (tapped name, list item) is what the map shows, so show it here too
    if (placeOverride) return { places: [placeOverride], inferred: false as const };
    return placesForVerse(geo, loc.chapter, selectedVerse);
  }, [selectedVerse, geo, loc.chapter, placeOverride]);

  const prevChapter = () => {
    if (loc.chapter > 1) goTo(loc.book, loc.chapter - 1);
    else {
      const i = BOOKS.findIndex((b) => b.osis === loc.book);
      if (i > 0) goTo(BOOKS[i - 1].osis, BOOKS[i - 1].chapters);
    }
  };
  const nextChapter = () => {
    if (loc.chapter < book.chapters) goTo(loc.book, loc.chapter + 1);
    else {
      const i = BOOKS.findIndex((b) => b.osis === loc.book);
      if (i < BOOKS.length - 1) goTo(BOOKS[i + 1].osis, 1);
    }
  };

  return (
    <div className={`app${mapVisible ? '' : ' map-hidden'}${journey ? ' journey-active' : ''}`}>
      <header className="topbar">
        <button className="brand" title="Bible Atlas: back to reading" onClick={() => periodsOpen && closePeriods()}>
          <span>BIBLE</span>
          <span>ATLAS</span>
        </button>
        <div className="nav">
          <button className="icon-btn" onClick={prevChapter} aria-label="Previous chapter">
            ‹
          </button>
          <select
            value={loc.book}
            onChange={(e) => goTo(e.target.value, 1)}
            aria-label="Book"
          >
            <optgroup label="Old Testament">
              {BOOKS.filter((b) => b.testament === 'OT').map((b) => (
                <option key={b.osis} value={b.osis}>
                  {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {BOOKS.filter((b) => b.testament === 'NT').map((b) => (
                <option key={b.osis} value={b.osis}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          </select>
          <select value={loc.chapter} onChange={(e) => goTo(loc.book, Number(e.target.value))} aria-label="Chapter">
            {Array.from({ length: book.chapters }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={nextChapter} aria-label="Next chapter">
            ›
          </button>
        </div>
        <button
          className={`menu-btn${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <span className="menu-btn-code">{translation.code.toUpperCase()}</span>
          <span aria-hidden>{menuOpen ? '✕' : '☰'}</span>
        </button>
        {/* On wide screens these sit in the header; on phones they fold into the ☰ menu. */}
        <div className={`topbar-extra${menuOpen ? ' open' : ''}`}>
        <label className="menu-field">
          <span className="menu-label">Translation</span>
        <select
          className="translation"
          value={translation.id}
          onChange={(e) => {
            setTranslationId(e.target.value);
            setMenuOpen(false);
          }}
          aria-label="Translation"
        >
          <optgroup label="Public domain (bible-api.com)">
            {BIBLE_API_TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code.toUpperCase()} — {t.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Modern translations (bolls.life)">
            {(bolls.length ? bolls : [translation].filter((t) => t.provider === 'bolls')).map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Official publisher API">
            <option value={ESV_TRANSLATION.id}>ESV — {ESV_TRANSLATION.name}</option>
          </optgroup>
        </select>
        </label>
        <label className="menu-field">
          <span className="menu-label">Follow a journey</span>
        <select
          className="journey-select"
          value={journeyId ?? ''}
          onChange={(e) => {
            const j = JOURNEYS.find((x) => x.id === e.target.value);
            setPlaying(false);
            setMenuOpen(false);
            if (j) {
              goToStop(j, 0);
              setMapVisible(true);
            } else setJourneyId(null);
          }}
          aria-label="Follow a journey"
        >
          <option value="">Follow a journey…</option>
          {(['OT', 'NT'] as const).map((t) => (
            <optgroup key={t} label={t === 'OT' ? 'Old Testament' : 'New Testament'}>
              {JOURNEYS.filter((j) => getBook(parseRef(j.stops[0].ref).book).testament === t).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        </label>
        <label className="menu-field">
          <span className="menu-label">Study a list</span>
          <select
            className="list-select"
            value={listId ?? ''}
            onChange={(e) => {
              setMenuOpen(false);
              openList(e.target.value);
            }}
            aria-label="Study a list"
          >
            <option value="">Study a list…</option>
            {LIST_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {LISTS.filter((l) => l.group === g).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="topbar-actions">
          <button
            className={`btn${periodsOpen ? ' active' : ''}`}
            onClick={() => {
              setMenuOpen(false);
              if (periodsOpen) closePeriods();
              else openPeriods(currentPeriod?.id);
            }}
            aria-pressed={periodsOpen}
          >
            Periods
          </button>
          <button
            className="btn"
            onClick={() => {
              setMapVisible(!mapVisible);
              setMenuOpen(false);
            }}
            aria-pressed={mapVisible}
          >
            {mapVisible ? 'Hide map' : 'Show map'}
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setSettingsOpen(true);
              setMenuOpen(false);
            }}
            aria-label="Settings"
          >
            ⚙<span className="narrow-only"> Settings</span>
          </button>
        </div>
        </div>
      </header>
      {menuOpen && <div className="menu-scrim" onClick={() => setMenuOpen(false)} />}

      {periodsOpen && (
        <PeriodsPage
          focusId={periodFocus}
          currentId={currentPeriod?.id ?? null}
          onClose={closePeriods}
          onRead={(b, c, v) => {
            goTo(b, c, v ?? null);
            closePeriods();
          }}
          onOpenList={(id) => {
            openList(id);
            closePeriods();
          }}
          onFollowJourney={(id) => {
            const j = JOURNEYS.find((x) => x.id === id);
            if (!j) return;
            setPlaying(false);
            goToStop(j, 0);
            setMapVisible(true);
            closePeriods();
          }}
        />
      )}

      <main className="layout" hidden={periodsOpen}>
        <section className="text-pane">
          {selectedInfo && selectedVerse != null && (
            <div className="verse-info" aria-live="polite">
              <div className="verse-info-ref">{formatRef(book.name, loc.chapter, selectedVerse)}</div>
              {selectedInfo.places.length ? (
                <div>
                  {selectedInfo.inferred ? 'No place named here — last mentioned: ' : 'Places: '}
                  {selectedInfo.places.map((p, i) => (
                    <button
                      key={p.index}
                      className="link"
                      onClick={() => {
                        setPlaceOverride(p);
                        if (p.index >= 0) setCardPlace(p);
                      }}
                    >
                      {p.name}
                      {i < selectedInfo.places.length - 1 ? ',' : ''}
                    </button>
                  ))}
                  {selectedInfo.inferred && selectedInfo.from && (
                    <span className="muted">
                      {' '}
                      ({selectedInfo.from.chapter !== loc.chapter ? `ch. ${selectedInfo.from.chapter}, ` : ''}v.{' '}
                      {selectedInfo.from.verse})
                    </span>
                  )}
                </div>
              ) : (
                <div className="muted">No places are mentioned in this chapter up to this verse.</div>
              )}
            </div>
          )}
          <Reader
            book={loc.book}
            bookName={book.name}
            chapter={loc.chapter}
            verses={verses}
            loading={loading}
            error={error}
            geo={geo}
            selectedVerse={selectedVerse}
            onSelectVerse={(v) => {
              setSelectedVerse(v);
              setPlaceOverride(null);
            }}
            onSelectPlace={(v, p) => {
              setSelectedVerse(v);
              setPlaceOverride(p);
              setCardPlace(p);
            }}
            onFollowJourney={(j, i) => {
              setPlaying(false);
              goToStop(j, i);
              setMapVisible(true);
            }}
            activeJourneyId={journeyId}
            activeList={studyList ? { id: studyList.id, index: listIndex } : null}
            onOpenListItem={(l, i) => openList(l.id, i)}
            period={currentPeriod ?? null}
            onOpenPeriod={openPeriods}
          />
          {studyList && (
            <ListPanel
              list={studyList}
              index={listIndex}
              playing={listPlaying}
              onGo={(i) => {
                setListPlaying(false);
                goToListItem(studyList, i);
              }}
              onTogglePlay={() => {
                if (!listPlaying && listIndex >= studyList.items.length - 1) goToListItem(studyList, 0);
                setListPlaying(!listPlaying);
              }}
              onClose={() => {
                setListPlaying(false);
                setListId(null);
              }}
            />
          )}
          <div className="chapter-nav">
            <button className="btn" onClick={prevChapter}>
              ‹ Previous chapter
            </button>
            <button className="btn" onClick={nextChapter}>
              Next chapter ›
            </button>
          </div>
        </section>

        {mapVisible && (
          <section className="map-pane">
            <MapView
              settings={mapSettings}
              chapterPlaces={geo?.all ?? []}
              focus={focus}
              journey={journey}
              stopIndex={stopIndex}
              testament={book.testament}
              onPlaceInfo={setCardPlace}
              onStopClick={(i) => journey && (setPlaying(false), goToStop(journey, i))}
            />
            <MapControls settings={mapSettings} onChange={setMapSettings} />
            {journey && (
              <JourneyPanel
                journey={journey}
                stopIndex={stopIndex}
                playing={playing}
                onPlaceInfo={openPlaceIndex}
                onGo={(i) => {
                  setPlaying(false);
                  goToStop(journey, i);
                }}
                onTogglePlay={() => {
                  if (!playing && stopIndex >= journey.stops.length - 1) goToStop(journey, 0);
                  setPlaying(!playing);
                }}
                onClose={() => {
                  setPlaying(false);
                  setJourneyId(null);
                }}
              />
            )}
          </section>
        )}
      </main>

      {cardPlace && (
        <PlaceCard
          place={cardPlace}
          onClose={() => setCardPlace(null)}
          onGoToRef={(ref) => goToRefForPlace(ref, cardPlace)}
          onFollowJourney={(j, i) => {
            setPlaying(false);
            goToStop(j, i);
            if (isNarrow()) setCardPlace(null);
          }}
        />
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
            <h2>Settings</h2>
            <label className="field">
              <span>ESV API key (optional)</span>
              <input
                type="password"
                value={esvKey}
                placeholder="Paste token from api.esv.org"
                onChange={(e) => setEsvKey(e.target.value.trim())}
              />
              <small className="muted">
                Free for personal use at{' '}
                <a href="https://api.esv.org/" target="_blank" rel="noreferrer">
                  api.esv.org
                </a>
                . Stored only in this browser.
              </small>
            </label>
            <h3>About the data</h3>
            <p className="muted small">
              Place identifications and verse links come from{' '}
              <a href="https://www.openbible.info/geo/" target="_blank" rel="noreferrer">
                OpenBible.info Bible Geocoding Data
              </a>{' '}
              (CC BY 4.0). Many ancient sites are uncertain; pins show the most likely identification. Journey legs are
              drawn as straight lines between stops, not exact routes. Bible text is loaded from bible-api.com
              (public-domain versions), bolls.life (modern versions), or the official ESV API.
            </p>
            <button className="btn primary" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
