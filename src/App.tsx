import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOOKS, getBook } from './data/books';
import {
  BIBLE_API_TRANSLATIONS,
  chapterPages,
  DEFAULT_TRANSLATION,
  ESV_COPYRIGHT,
  ESV_TRANSLATION,
  EsvKeyMissing,
  FALLBACK_TRANSLATION,
  fetchPassage,
  findTranslation,
  OPEN_TRANSLATIONS,
  type Verse,
} from './lib/bible';
import { loadChapterGeo, placesForVerse, type ChapterGeo, type Place } from './lib/geo';
import { JOURNEYS, parseRef, type Journey } from './lib/journeys';
import { usePersistentState } from './lib/usePersistentState';
import MapView, { DEFAULT_MAP_SETTINGS, MapErrorBoundary, type MapFocus, type MapSettings } from './components/MapView';
import MapControls from './components/MapControls';
import Reader from './components/Reader';
import JourneyPanel, { useJourneyLegs } from './components/JourneyPanel';
import PlaceCard from './components/PlaceCard';
import { loadPlaces } from './lib/geo';
import PeriodsPage from './components/PeriodsPage';
import PeoplePage from './components/PeoplePage';
import NationsPage from './components/NationsPage';
import PersonCard from './components/PersonCard';
import WordStudy from './components/WordStudy';
import SiteSearch from './components/SiteSearch';
import DistancePanel, { useRoadRoute, type Measure } from './components/DistancePanel';
import { loadChapterPeople, type PersonEntry } from './lib/people';
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
  // ESV by default, through Crossway's official API only. (Older saved choices from the
  // retired bolls.life source are treated as ESV.)
  const [savedTranslation, setTranslationId] = usePersistentState('translation-v2', DEFAULT_TRANSLATION);
  const translationId =
    savedTranslation.startsWith('bolls:') && !OPEN_TRANSLATIONS.some((t) => t.id === savedTranslation)
      ? DEFAULT_TRANSLATION
      : savedTranslation;
  // Each reader's own free key from api.esv.org, kept only in their browser. (A key is never
  // built into the published site, where anyone could read it.)
  // a personal ESV key saved by an earlier version of the app is still used as a backup (no longer editable)
  const [esvKey] = usePersistentState('esvKey', '');
  const [esvPageIndex, setEsvPageIndex] = useState(0);
  /** set when the ESV couldn't be used and a public-domain version is shown instead */
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [mapSettings, setMapSettings] = usePersistentState<MapSettings>('map', DEFAULT_MAP_SETTINGS);
  const [mapVisible, setMapVisible] = usePersistentState('mapVisible', true);

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
  const [personSlug, setPersonSlug] = useState<string | null>(null);
  const [chapterPeople, setChapterPeople] = useState<Map<number, PersonEntry[]>>(new Map());
  /** the distance tool: open while not null */
  const [measure, setMeasure] = useState<Measure | null>(null);
  const road = useRoadRoute(measure);
  const samePlace = (x: Place | null, y: Place) => !!x && x.index === y.index && x.lat === y.lat && x.lon === y.lon;
  /** While measuring, tapping a place on the map fills the next end instead of opening its card. */
  const onMapPlace = (p: Place) => {
    if (!measure) return setCardPlace(p);
    if (samePlace(measure.a, p) || samePlace(measure.b, p)) return;
    setMeasure(!measure.a ? { ...measure, a: p } : { ...measure, b: p });
  };

  // only one info card at a time (place, person, or Hebrew/Greek word study)
  const [wordStudyOpen, setWordStudyOpen] = useState(false);
  useEffect(() => {
    if (cardPlace) {
      setPersonSlug(null);
      setWordStudyOpen(false);
    }
  }, [cardPlace]);
  useEffect(() => {
    if (personSlug) {
      setCardPlace(null);
      setWordStudyOpen(false);
    }
  }, [personSlug]);
  useEffect(() => {
    if (wordStudyOpen) {
      setCardPlace(null);
      setPersonSlug(null);
    }
  }, [wordStudyOpen]);
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
  const peopleOpen = hash.startsWith('#people');
  const nationsOpen = hash.startsWith('#nations');
  const pageOpen = periodsOpen || peopleOpen || nationsOpen;
  const nationFocus = nationsOpen ? (hash.split('/')[1] ?? null) : null;
  const openNations = (id?: string) => {
    window.location.hash = id ? `nations/${id}` : 'nations';
  };
  const openPeople = () => {
    window.location.hash = 'people';
  };
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
  const chosenTranslation = findTranslation(translationId);
  const translation = fallbackReason ? findTranslation(FALLBACK_TRANSLATION) : chosenTranslation;
  const journey = JOURNEYS.find((j) => j.id === journeyId) ?? null;
  const journeyLegs = useJourneyLegs(journey);

  // Screens for this chapter: one, unless a licensed translation's per-page limit splits it
  const pages = chapterPages(chosenTranslation, loc.book, loc.chapter);
  const pageIndex = Math.min(esvPageIndex, pages.length - 1);
  const page = pages[pageIndex];
  useEffect(() => setEsvPageIndex(0), [loc.book, loc.chapter, translationId]);
  // jumping to a verse opens the screen that contains it
  useEffect(() => {
    if (selectedVerse == null || pages.length < 2) return;
    const i = pages.findIndex((pg) => selectedVerse >= pg.from && selectedVerse <= pg.to);
    if (i >= 0 && i !== pageIndex) setEsvPageIndex(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerse, loc.book, loc.chapter]);
  useEffect(() => setFallbackReason(null), [translationId, esvKey]);

  // Load chapter text
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPassage(chosenTranslation, loc.book, loc.chapter, page, { esvKey })
      .catch((e: Error) => {
        // the ESV isn't available: show the public-domain WEB instead, and say why
        if (e instanceof EsvKeyMissing && chosenTranslation.provider === 'esv') {
          if (!cancelled) setFallbackReason(e.message);
          const web = findTranslation(FALLBACK_TRANSLATION);
          return fetchPassage(web, loc.book, loc.chapter, chapterPages(web, loc.book, loc.chapter)[0]);
        }
        throw e;
      })
      .then((v) => !cancelled && setVerses(v))
      .catch((e: Error) => !cancelled && (setError(e.message), setVerses(null)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [chosenTranslation.id, loc.book, loc.chapter, esvKey, page.from, page.to]); // eslint-disable-line react-hooks/exhaustive-deps

  // People named in each verse of the chapter
  useEffect(() => {
    let cancelled = false;
    setChapterPeople(new Map());
    loadChapterPeople(loc.book, loc.chapter).then((m) => !cancelled && setChapterPeople(m));
    return () => {
      cancelled = true;
    };
  }, [loc.book, loc.chapter]);

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
    // a place opened from a person card can be pinned without a verse selected
    if (selectedVerse == null && placeOverride) return { places: [placeOverride], inferred: false, label: placeOverride.name };
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
    <div className={`app${mapVisible ? '' : ' map-hidden'}${journey ? ' journey-active' : ''}${measure ? ' measuring' : ''}`}>
      <header className="topbar">
        <button className="brand" title="Bible Study Companion: back to reading" onClick={() => pageOpen && closePeriods()}>
          <span>BIBLE STUDY</span>
          <span>COMPANION</span>
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
        <SiteSearch
          onGoTo={(b, c, v) => {
            if (pageOpen) closePeriods();
            goTo(b, c, v);
          }}
          onOpenPerson={setPersonSlug}
          onOpenPlace={(i) => {
            if (pageOpen) closePeriods();
            setMapVisible(true);
            setSelectedVerse(null);
            loadPlaces().then((ps) => {
              setPlaceOverride(ps[i]);
              setCardPlace(ps[i]);
            });
          }}
          onFollowJourney={(id, i) => {
            const j = JOURNEYS.find((x) => x.id === id);
            if (!j) return;
            if (pageOpen) closePeriods();
            setPlaying(false);
            goToStop(j, i);
            setMapVisible(true);
          }}
          onOpenList={(id, i) => {
            if (pageOpen) closePeriods();
            openList(id, i);
          }}
          onOpenPeriod={openPeriods}
          onOpenNation={openNations}
        />
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
          value={chosenTranslation.id}
          onChange={(e) => {
            setTranslationId(e.target.value);
            setMenuOpen(false);
          }}
          aria-label="Translation"
        >
          <optgroup label="Licensed (Crossway's official ESV API)">
            <option value={ESV_TRANSLATION.id}>ESV — {ESV_TRANSLATION.name}</option>
          </optgroup>
          {OPEN_TRANSLATIONS.length > 0 && (
            <optgroup label="Freely licensed">
              {OPEN_TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Public domain">
            {BIBLE_API_TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code.toUpperCase()} — {t.name}
              </option>
            ))}
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
            className={`btn${peopleOpen ? ' active' : ''}`}
            onClick={() => {
              setMenuOpen(false);
              if (peopleOpen) closePeriods();
              else openPeople();
            }}
            aria-pressed={peopleOpen}
          >
            People
          </button>
          <button
            className={`btn${nationsOpen ? ' active' : ''}`}
            onClick={() => {
              setMenuOpen(false);
              if (nationsOpen) closePeriods();
              else openNations();
            }}
            aria-pressed={nationsOpen}
          >
            Nations
          </button>
          <button
            className="btn"
            onClick={() => {
              setMenuOpen(false);
              // on the People or Periods page, this takes you back to reading with the map showing
              if (pageOpen) {
                closePeriods();
                setMapVisible(true);
              } else setMapVisible(!mapVisible);
            }}
            aria-pressed={mapVisible && !pageOpen}
          >
            {mapVisible && !pageOpen ? 'Hide map' : 'Show map'}
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

      {peopleOpen && <PeoplePage onClose={closePeriods} onOpenPerson={setPersonSlug} />}

      {nationsOpen && (
        <NationsPage
          focusId={nationFocus}
          onClose={closePeriods}
          onOpenPerson={setPersonSlug}
          onRead={(b, c, v) => {
            goTo(b, c, v);
            closePeriods();
          }}
          onShowOnMap={(n) => {
            closePeriods();
            setMapVisible(true);
            setSelectedVerse(null);
            setPersonSlug(null);
            setPlaceOverride({ index: -1, name: n.name, lat: n.lat, lon: n.lon, type: 'region', confidence: 50 });
          }}
        />
      )}

      <main className="layout" hidden={pageOpen}>
        <section className="text-pane">
          {selectedInfo && selectedVerse != null && (
            <div className="verse-info" aria-live="polite">
              <div className="verse-info-ref">
                {formatRef(book.name, loc.chapter, selectedVerse)}
                <button
                  className={`word-study-btn${wordStudyOpen ? ' on' : ''}`}
                  onClick={() => setWordStudyOpen(!wordStudyOpen)}
                  title={`See the ${book.testament === 'OT' ? 'Hebrew' : 'Greek'} words of this verse`}
                >
                  {book.testament === 'OT' ? 'Hebrew' : 'Greek'}
                </button>
              </div>
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
              {(chapterPeople.get(selectedVerse) ?? []).length > 0 && (
                <div className="verse-info-people">
                  People:{' '}
                  {chapterPeople.get(selectedVerse)!.map((p, i, arr) => (
                    <button key={p.slug} className="link" onClick={() => setPersonSlug(p.slug)}>
                      {p.name}
                      {i < arr.length - 1 ? ',' : ''}
                    </button>
                  ))}
                </div>
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
            people={chapterPeople}
            onSelectPerson={(v, slug) => {
              setSelectedVerse(v);
              setPersonSlug(slug);
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
            before={
              <>
                {fallbackReason && (
                  <div className="text-notice">
                    <strong>Showing the World English Bible.</strong>{' '}
                    The ESV service isn't available right now ({fallbackReason}). Please try again in a little while.
                  </div>
                )}
                {!fallbackReason && pages.length > 1 && (
                  <div className="text-notice part-nav">
                    <span>
                      <strong>
                        Part {pageIndex + 1} of {pages.length}
                      </strong>{' '}
                      · verses {page.from}–{page.to}
                    </span>
                    <span className="part-buttons">
                      <button
                        className="btn"
                        disabled={pageIndex === 0}
                        onClick={() => {
                          setSelectedVerse(null);
                          setEsvPageIndex(pageIndex - 1);
                        }}
                      >
                        ‹ Previous part
                      </button>
                      <button
                        className="btn"
                        disabled={pageIndex === pages.length - 1}
                        onClick={() => {
                          setSelectedVerse(null);
                          setEsvPageIndex(pageIndex + 1);
                        }}
                      >
                        Next part ›
                      </button>
                    </span>
                    <small className="muted">
                      Crossway's free ESV license shows at most half of a book on screen at a time.
                    </small>
                  </div>
                )}
              </>
            }
            after={
              translation.provider === 'esv' ? (
                <p className="copyright-notice">
                  <strong>ESV</strong> · {ESV_COPYRIGHT}{' '}
                  <a href="https://www.esv.org/" target="_blank" rel="noreferrer">
                    ESV.org
                  </a>
                </p>
              ) : translation.notice ? (
                <p className="copyright-notice">
                  <strong>{translation.code}</strong> · {translation.notice}
                </p>
              ) : (
                <p className="copyright-notice">
                  {translation.code.toUpperCase()} · {translation.name}, public domain.
                </p>
              )
            }
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
            <MapErrorBoundary>
            <MapView
              settings={mapSettings}
              chapterPlaces={geo?.all ?? []}
              focus={focus}
              journey={journey}
              stopIndex={stopIndex}
              testament={book.testament}
              onPlaceInfo={onMapPlace}
              measure={measure}
              roadPath={road?.state === 'found' ? road.route.path : null}
              roadMiles={road?.state === 'found' ? road.route.miles : null}
              journeyLegs={journeyLegs}
              onStopClick={(i) => journey && (setPlaying(false), goToStop(journey, i))}
            />
            </MapErrorBoundary>
            <MapControls
              settings={mapSettings}
              onChange={setMapSettings}
              measuring={!!measure}
              onToggleMeasure={() => setMeasure(measure ? null : { a: null, b: null })}
            />
            {measure && (
              <DistancePanel measure={measure} road={road} onChange={setMeasure} onClose={() => setMeasure(null)} />
            )}
            {journey && (
              <JourneyPanel
                journey={journey}
                stopIndex={stopIndex}
                playing={playing}
                onPlaceInfo={openPlaceIndex}
                legs={journeyLegs}
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

      {wordStudyOpen && selectedVerse != null && !pageOpen && (
        <WordStudy
          book={loc.book}
          chapter={loc.chapter}
          verse={selectedVerse}
          onClose={() => setWordStudyOpen(false)}
          onGoToRef={(ref) => {
            const r = parseRef(ref);
            goTo(r.book, r.chapter, r.verse);
          }}
        />
      )}

      {personSlug && (
        <PersonCard
          slug={personSlug}
          onClose={() => setPersonSlug(null)}
          onOpenPerson={setPersonSlug}
          onOpenNation={(id) => {
            openNations(id);
            if (isNarrow()) setPersonSlug(null);
          }}
          onGoToRef={(ref) => {
            const r = parseRef(ref);
            if (pageOpen) closePeriods();
            goTo(r.book, r.chapter, r.verse);
            if (isNarrow()) setPersonSlug(null);
          }}
          onOpenPlace={(at) => {
            if (pageOpen) closePeriods();
            if (at.place != null) {
              loadPlaces().then((ps) => {
                setPlaceOverride(ps[at.place!]);
                setCardPlace(ps[at.place!]);
              });
            } else if (at.lat != null && at.lon != null) {
              setMapVisible(true);
              setPlaceOverride({ index: -1, name: at.name, lat: at.lat, lon: at.lon, type: 'place', confidence: 50 });
              if (isNarrow()) setPersonSlug(null);
            }
          }}
        />
      )}

      {cardPlace && (
        <PlaceCard
          place={cardPlace}
          onOpenPerson={setPersonSlug}
          onClose={() => setCardPlace(null)}
          onGoToRef={(ref) => goToRefForPlace(ref, cardPlace)}
          onMeasureFrom={(p) => {
            setMeasure({ a: p, b: null });
            setMapVisible(true);
            setCardPlace(null);
          }}
          onFollowJourney={(j, i) => {
            setPlaying(false);
            goToStop(j, i);
            if (isNarrow()) setCardPlace(null);
          }}
        />
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sources and licenses">
            <h2>Sources & licenses</h2>
            <div className="licenses small">
              <p>
                <strong>ESV.</strong> {ESV_COPYRIGHT} Provided through Crossway's free{' '}
                <a href="https://api.esv.org/" target="_blank" rel="noreferrer">
                  ESV API
                </a>{' '}
                for non-commercial use. This app has no ads, charges nothing and asks for no donations. In keeping with
                the terms, it shows at most 500 verses or half a book at a time, keeps no more than 500 ESV verses on
                your device (in memory only), and labels ESV text. See{' '}
                <a href="https://www.esv.org/" target="_blank" rel="noreferrer">
                  ESV.org
                </a>
                .
              </p>
              <p>
                <strong>Public-domain translations</strong> (WEB, KJV, ASV, BBE, Darby, YLT, OEB) are free to use
                without restriction, served by{' '}
                <a href="https://bible-api.com/" target="_blank" rel="noreferrer">
                  bible-api.com
                </a>
                .
              </p>
              <p>
                <strong>Hebrew & Greek word study:</strong> words, transliterations, glosses, grammar and brief
                lexicons from{' '}
                <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">
                  STEPBible Data
                </a>{' '}
                by Tyndale House, Cambridge (
                <a href="https://www.STEPBible.org" target="_blank" rel="noreferrer">
                  STEPBible.org
                </a>
                ),{' '}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                  CC BY 4.0
                </a>
                . Lexicon entries are based on Brown-Driver-Briggs and Abbott-Smith (public domain). The Greek follows
                the editions used by most modern translations; words found only in the KJV's Greek are marked.
              </p>
              <p>
                <strong>Places & verse links:</strong>{' '}
                <a href="https://www.openbible.info/geo/" target="_blank" rel="noreferrer">
                  OpenBible.info Bible Geocoding Data
                </a>
                ,{' '}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                  CC BY 4.0
                </a>
                . Many ancient sites are uncertain; pins show the most likely identification.
              </p>
              <p>
                <strong>People, families & dates:</strong>{' '}
                <a href="https://github.com/robertrouse/theographic-bible-metadata" target="_blank" rel="noreferrer">
                  Theographic Bible Metadata
                </a>
                ,{' '}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
                  CC BY-SA 4.0
                </a>{' '}
                (this app's derived people data is shared under the same license). Biographies: Easton's Bible
                Dictionary (1897), public domain.
              </p>
              <p>
                <strong>Place histories & photos:</strong>{' '}
                <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
                  Wikipedia
                </a>{' '}
                text under{' '}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
                  CC BY-SA 4.0
                </a>
                , with each card linking to its article; images from Wikimedia Commons under their own licenses (see
                the linked article). Founding dates:{' '}
                <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">
                  Wikidata
                </a>{' '}
                (CC0).
              </p>
              <p>
                <strong>Maps:</strong> terrain, relief, satellite and modern labels © Esri and its data providers
                (Powered by Esri); street map ©{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  OpenStreetMap contributors
                </a>{' '}
                (ODbL); Roman Empire map:{' '}
                <a href="https://imperium.ahlfeldt.se/" target="_blank" rel="noreferrer">
                  Digital Atlas of the Roman Empire
                </a>{' '}
                (CC BY 4.0); lakes & rivers:{' '}
                <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
                  Natural Earth
                </a>{' '}
                (public domain); ancient roads for the distance tool:{' '}
                <a href="https://itiner-e.org/" target="_blank" rel="noreferrer">
                  Itiner-e: The Digital Atlas of Ancient Roads
                </a>{' '}
                by de Soto, Pažout, Brughmans et al. (
                <a href="https://doi.org/10.1038/s41597-025-06140-z" target="_blank" rel="noreferrer">
                  Scientific Data, 2025
                </a>
                ; 2024 static version,{' '}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                  CC BY 4.0
                </a>
                ), clipped to the Bible lands, simplified and joined into a network for route finding; map library:{' '}
                <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">
                  Leaflet
                </a>
                .
              </p>
              <p>
                <strong>Periods of Bible history</strong> follow the outline arranged by Bob and Sandra Waldron. Summaries
                in this app are original. Fonts: Figtree and EB Garamond (SIL Open Font License).
              </p>
              <p className="muted">
                Journey legs follow Roman-era roads (Itiner-e) where a road joins the stops without a long detour; sea
                crossings and wilderness legs are drawn stop to stop, and a few follow hand-traced routes. They show the
                likely way, not an exact record.
              </p>
            </div>
            <button className="btn primary" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
