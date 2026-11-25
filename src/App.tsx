import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, getBook } from './data/books';
import {
  APIBIBLE_TRANSLATIONS,
  BIBLE_API_TRANSLATIONS,
  chapterPages,
  DEFAULT_TRANSLATION,
  ESV_COPYRIGHT,
  ESV_TRANSLATION,
  FALLBACK_TRANSLATION,
  fetchPassage,
  findTranslation,
  isLicensed,
  LicensedUnavailable,
  OPEN_TRANSLATIONS,
  translationNotice,
  type Verse,
} from './lib/bible';
import { loadChapterGeo, placesForVerse, type ChapterGeo, type Place } from './lib/geo';
import { allJourneys, isMine, JOURNEYS, parseRef, type Journey } from './lib/journeys';
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
import NationCard from './components/NationCard';
import JerusalemPage from './components/JerusalemPage';
import PickerSelect from './components/PickerSelect';
import CompareGospels from './components/CompareGospels';
import { PARALLELS, type ParallelSet } from './data/parallels';
import { nationsInVerse } from './lib/nationMentions';
import DistancePanel, { useRoadRoute, type Measure } from './components/DistancePanel';
import { loadChapterPeople, type PersonEntry } from './lib/people';
import ListPanel from './components/ListPanel';
import { allLists, LISTS, LIST_GROUPS, type StudyList } from './lib/lists';
import { copyBuiltIn, myId, noteIdOf } from './lib/mine';
import { closeSharedLesson, loadShares, loadSharedLesson, saveSharedCopy, type OpenLesson } from './lib/lessons';
import type { LessonStep } from './lib/notes';
import { spanFromOsis } from './lib/refs';
import { periodFor } from './data/periods';
import { ACCOUNTS_ENABLED, LESSONS_ENABLED, MINE_ENABLED, NOTES_ENABLED } from './config';
import { addBookmark, api, getAccount, initAccount, removeBookmark, useAccount, type SyncedPrefs } from './lib/account';
import { useTextPrefs } from './components/TextSizeControl';
import type { AccountStart } from './components/AccountPanel';
import PrivacyPage from './components/PrivacyPage';
import Preferences from './components/Preferences';
import { lazyPart, PartBoundary } from './lib/lazyPart';
import { loadNotes, noteMarks as noteMarksIn, pagesMentioning, useNotes, verseNotesAt } from './lib/notes';
import type { Span } from './lib/refs';

// the sign-in screens load only when someone opens them
const AccountPanel = lazyPart(() => import('./components/AccountPanel'));
const NotesPage = lazyPart(() => import('./components/NotesPage'));
const VerseNotes = lazyPart(() => import('./components/VerseNotes'));
const LessonReturn = lazyPart(() => import('./components/LessonPanel'));
const LessonPage = lazyPart(() => import('./components/LessonPage'));
const LessonIntro = lazyPart(() => import('./components/LessonPanel').then((m) => ({ default: m.LessonIntro })));

interface Location {
  book: string;
  chapter: number;
}

const formatRef = (bookName: string, chapter: number, verse: number) => `${bookName} ${chapter}:${verse}`;

export default function App() {
  // always opens at Genesis 1 (the owner's choice); the chapter isn't remembered between visits
  const [loc, setLoc] = useState<Location>({ book: 'Gen', chapter: 1 });
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

  // only one info card at a time (place, person, nation, or Hebrew/Greek word study)
  const [wordStudyOpen, setWordStudyOpen] = useState(false);
  const [nationId, setNationId] = useState<string | null>(null);
  const [compareSet, setCompareSet] = useState<ParallelSet | null>(null);
  useEffect(() => {
    if (cardPlace) {
      setPersonSlug(null);
      setWordStudyOpen(false);
      setNationId(null);
    }
  }, [cardPlace]);
  useEffect(() => {
    if (personSlug) {
      setCardPlace(null);
      setWordStudyOpen(false);
      setNationId(null);
    }
  }, [personSlug]);
  useEffect(() => {
    if (wordStudyOpen) {
      setCardPlace(null);
      setPersonSlug(null);
      setNationId(null);
    }
  }, [wordStudyOpen]);
  useEffect(() => {
    if (nationId) {
      setCardPlace(null);
      setPersonSlug(null);
      setWordStudyOpen(false);
    }
  }, [nationId]);
  const [listId, setListId] = useState<string | null>(null);
  const [listIndex, setListIndex] = useState(0);
  const [listPlaying, setListPlaying] = useState(false);
  const studyList = allLists().find((l) => l.id === listId) ?? null;
  const [hash, setHash] = useState(() => window.location.hash);
  // ---- Accounts (off until set up; see accounts/README.md)
  const account = useAccount();
  const [accountStart, setAccountStart] = useState<AccountStart | null>(null);
  useEffect(() => {
    initAccount();
  }, []);
  // links from account emails: "#account/verify/<code>", "#account/reset/<code>", "#account/email/<code>"
  useEffect(() => {
    const m = hash.match(/^#account(?:\/(verify|reset|email)\/([A-Za-z0-9_-]{43}))?$/);
    if (!m || !ACCOUNTS_ENABLED) return;
    // take the code out of the address bar and history straight away
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setHash('');
    setAccountStart(m[1] ? { view: m[1] as 'verify' | 'reset' | 'email', token: m[2] } : { view: 'account' });
  }, [hash]);
  const { prefs: textPrefs, setPrefs: setTextPrefs } = useTextPrefs();
  // ---- Notes: loaded once signed in; hidden while presenting unless "Show my notes" is on
  const notesStore = useNotes();
  useEffect(() => {
    if (NOTES_ENABLED && account.status === 'signed-in') loadNotes();
    if (LESSONS_ENABLED && account.status === 'signed-in') loadShares();
  }, [account.status]);
  // ---- Class lessons: playing one (yours, or shared with you by link)
  const [lesson, setLesson] = useState<OpenLesson | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  /** false while you've stepped out of the lesson (to read, follow a journey or use the big map) */
  const [lessonShown, setLessonShown] = useState(true);
  /** presenting: one step forward or back in the lesson (n changes on each press) */
  const [lessonJump, setLessonJump] = useState({ d: 0, n: 0 });
  const [lessonIntro, setLessonIntro] = useState<OpenLesson | null>(null);
  const [lessonMsg, setLessonMsg] = useState<string | null>(null);
  // a shared lesson's link: "#lesson/<code>"
  useEffect(() => {
    const m = hash.match(/^#lesson\/([A-Za-z0-9_-]{22})$/);
    if (!m || !LESSONS_ENABLED) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setHash('');
    loadSharedLesson(m[1])
      .then(setLessonIntro)
      .catch((e) => setLessonMsg(e instanceof Error ? e.message : 'Couldn’t open this lesson.'));
  }, [hash]);
  const [verseNotesAtVerse, setVerseNotesAtVerse] = useState<number | null>(null);
  const [presentNotes, setPresentNotes] = useState(false);
  // Synced preferences. On signing in, the account's saved ones are used (a new account gets this
  // device's); after that, changes are saved to the account a moment later.
  const prefsSynced = useRef<string | null>(null);
  const currentPrefs: SyncedPrefs = useMemo(
    () => ({
      translation: savedTranslation,
      text: { size: textPrefs.size, bold: textPrefs.bold },
      map: mapSettings as unknown as Record<string, unknown>,
    }),
    [savedTranslation, textPrefs, mapSettings],
  );
  useEffect(() => {
    if (account.status !== 'signed-in' || !account.user) {
      prefsSynced.current = null;
      return;
    }
    if (prefsSynced.current === null) {
      const p = account.user.prefs;
      prefsSynced.current = '';
      if (p && Object.keys(p).length) {
        if (typeof p.translation === 'string' && findTranslation(p.translation).id === p.translation)
          setTranslationId(p.translation);
        if (p.text) setTextPrefs({ size: Number(p.text.size) || 0, bold: !!p.text.bold });
        if (p.map) setMapSettings({ ...DEFAULT_MAP_SETTINGS, ...(p.map as Partial<MapSettings>) });
        prefsSynced.current = JSON.stringify({ ...currentPrefs, ...p });
        return;
      }
    }
    const json = JSON.stringify(currentPrefs);
    if (json === prefsSynced.current) return;
    const t = setTimeout(() => {
      if (getAccount().status !== 'signed-in') return;
      prefsSynced.current = json;
      api('/prefs', { prefs: currentPrefs }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [account.status, account.user?.username, currentPrefs]); // eslint-disable-line react-hooks/exhaustive-deps
  // moving to a page (People, Nations, Jerusalem…) puts the comparison away
  useEffect(() => setCompareSet(null), [hash]);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // "#periods" or "#periods/<id>" shows the periods page (so the back button works)
  const periodsOpen = hash.startsWith('#periods');
  const peopleOpen = hash.startsWith('#people');
  const nationsOpen = hash.startsWith('#nations');
  const jerusalemOpen = hash.startsWith('#jerusalem');
  const privacyOpen = hash.startsWith('#privacy');
  const notesOpen = NOTES_ENABLED && hash.startsWith('#notes');
  const pageOpen = periodsOpen || peopleOpen || nationsOpen || jerusalemOpen || privacyOpen || notesOpen;
  const spotFocus = jerusalemOpen ? (hash.split('/')[1] ?? null) : null;
  /** the Jerusalem page, at a place on its plans */
  const openSpot = (id?: string) => {
    window.location.hash = id ? `jerusalem/${id}` : 'jerusalem';
  };
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
  /** the lesson page, when a lesson is open and you haven't stepped out of it */
  const lessonView = !!lesson && lessonShown && !pageOpen;
  const anyPage = pageOpen || lessonView;
  /** back to reading: closes any page, and steps out of the lesson (it stays open to come back to) */
  const leavePages = () => {
    if (pageOpen) closePeriods();
    setLessonShown(false);
  };

  const book = getBook(loc.book);
  const currentPeriod = periodFor(loc.book, loc.chapter);
  const chosenTranslation = findTranslation(translationId);
  const translation = fallbackReason ? findTranslation(FALLBACK_TRANSLATION) : chosenTranslation;
  const journey = allJourneys().find((j) => j.id === journeyId) ?? null;
  // API.Bible's terms: printing of its translations stops after 100 verses (see .print-limit in styles.css)
  useEffect(() => {
    document.body.classList.toggle('print-limit', translation.provider === 'apibible');
  }, [translation.provider]);
  const [presenting, setPresenting] = useState(false);
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
        // a licensed translation isn't available: show the public-domain WEB instead, and say why
        if (e instanceof LicensedUnavailable && isLicensed(chosenTranslation)) {
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

  // ---- Lessons: each step moves the reader and map
  /** a step's page or link (the "Open …" button, and page steps when reached) */
  const lessonAction = (s: LessonStep) => {
    if (s.type === 'link' && s.url) window.open(s.url, '_blank', 'noopener,noreferrer');
    if (s.type !== 'page' || !s.id) return;
    if (s.pageType === 'person') setPersonSlug(s.id);
    else if (s.pageType === 'nation') setNationId(s.id);
    else if (s.pageType === 'period') openPeriods(s.id);
    else if (s.pageType === 'jerusalem') openSpot(s.id);
  };
  /** the lesson page's buttons: each steps out of the lesson to the reader or the big map */
  const lessonShowPlace = (s: LessonStep) => {
    leavePages();
    const sp = s.ref ? spanFromOsis(s.ref) : null;
    if (sp) goTo(sp.osis, sp.chapter, sp.verse ?? null);
    if (s.lat != null && s.lon != null) {
      setMapVisible(true);
      setPlaceOverride({ index: s.placeIndex ?? -1, name: s.place ?? 'A spot on the map', lat: s.lat, lon: s.lon, type: 'region', confidence: 50 });
    }
  };
  const startLesson = (l: OpenLesson) => {
    setLesson(l);
    setLessonIndex(0);
    setLessonJump({ d: 0, n: 0 });
    setLessonShown(true);
  };
  const closeLesson = () => {
    if (lesson?.kind === 'shared') closeSharedLesson();
    setLesson(null);
    setLessonShown(true);
  };

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
    const l = allLists().find((x) => x.id === id);
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

  // nations the selected verse names, for the verse bar
  const selectedNations = useMemo(() => {
    const text = selectedVerse != null ? verses?.find((v) => v.verse === selectedVerse)?.text : undefined;
    return text ? nationsInVerse(text) : [];
  }, [selectedVerse, verses]);

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

  // ---- Presenting mode: full screen, large text, stepping with the arrow keys or a clicker
  /** One step forward or back: through the journey, else the study list, else the chapter's verses. */
  const presentStep = (d: number) => {
    if (lessonView && lesson) {
      setLessonJump((j) => ({ d, n: j.n + 1 }));
    } else if (journey) {
      setPlaying(false);
      goToStop(journey, Math.max(0, Math.min(journey.stops.length - 1, stopIndex + d)));
    } else if (studyList) {
      setListPlaying(false);
      goToListItem(studyList, Math.max(0, Math.min(studyList.items.length - 1, listIndex + d)));
    } else if (verses?.length) {
      const nums = verses.map((v) => v.verse);
      const at = selectedVerse == null ? -1 : nums.indexOf(selectedVerse);
      const next = at + d;
      if (next >= nums.length) nextChapter();
      else if (next >= 0) {
        setSelectedVerse(nums[next]);
        setPlaceOverride(null);
      }
    }
  };
  const presentStepRef = useRef(presentStep);
  presentStepRef.current = presentStep;
  const anyCardOpen = !!(
    compareSet ||
    personSlug ||
    nationId ||
    cardPlace ||
    wordStudyOpen ||
    settingsOpen ||
    accountStart ||
    verseNotesAtVerse != null
  );
  const showNotes = NOTES_ENABLED && account.status === 'signed-in' && (!presenting || presentNotes);
  // your own journeys and lists (kept in step with your notes by lib/mine.ts)
  const showMine = MINE_ENABLED && account.status === 'signed-in';
  const myJourneys = useMemo(() => (showMine ? allJourneys().filter((j) => isMine(j.id)) : []), [showMine, notesStore]); // eslint-disable-line react-hooks/exhaustive-deps
  const myLists = useMemo(() => (showMine ? allLists().filter((l) => isMine(l.id)) : []), [showMine, notesStore]); // eslint-disable-line react-hooks/exhaustive-deps
  /** the small button on a journey or list panel: copy a built-in one, or edit your own */
  const panelAction = (kind: 'journey' | 'list', id: string) =>
    !showMine ? undefined : isMine(id) ? (
      <button className="link-button panel-mine" onClick={() => (window.location.hash = `notes/${kind}/${noteIdOf(id)}`)}>
        Edit
      </button>
    ) : (
      <button
        className="link-button panel-mine"
        onClick={async () => {
          try {
            const n = await copyBuiltIn(kind, id);
            if (kind === 'journey') setJourneyId(myId(n.id));
            else setListId(myId(n.id));
            window.location.hash = `notes/${kind}/${n.id}`;
          } catch (e) {
            alert(e instanceof Error ? e.message : 'Couldn’t make a copy.');
          }
        }}
      >
        Make my own copy
      </button>
    );
  const chapterNoteMarks = useMemo(
    () => (showNotes ? noteMarksIn(loc.book, loc.chapter, notesStore) : undefined),
    [showNotes, loc.book, loc.chapter, notesStore],
  );
  /** a verse link in a note: back to reading there */
  const openSpan = (s: Span) => {
    setVerseNotesAtVerse(null);
    leavePages();
    goTo(s.osis, s.chapter, s.verse);
  };
  // links in downloaded files: "#read/John.3.16-John.3.21" opens the reader there
  useEffect(() => {
    const m = hash.match(/^#read\/([1-3]?[A-Za-z]+\.\d+(?:\.\d+)?(?:-[1-3]?[A-Za-z]+\.\d+(?:\.\d+)?)?)$/);
    if (!m) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setHash('');
    const s = spanFromOsis(m[1]);
    if (s && BOOKS.some((b) => b.osis === s.osis)) openSpan(s);
  }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const anyCardOpenRef = useRef(anyCardOpen);
  anyCardOpenRef.current = anyCardOpen;
  const compareOpenRef = useRef(false);
  compareOpenRef.current = !!compareSet;

  const startPresenting = () => {
    setPresenting(true);
    setMenuOpen(false);
    setMapVisible(true);
    if (!lessonView && !journey && !studyList && selectedVerse == null && verses?.length) setSelectedVerse(verses[0].verse);
    document.documentElement.requestFullscreen?.().catch(() => {}); // not every browser allows it; the layout still changes
  };
  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, select, textarea, [contenteditable="true"]')) return;
      const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key);
      if (e.key === 'Escape') {
        if (!anyCardOpenRef.current) stopPresenting(); // with a card open, Esc closes the card first
        return;
      }
      if (!forward && !back) return;
      if (compareOpenRef.current) return; // the comparison steps its own events
      // a button with focus would also "click" on Space/Enter: step only once
      e.preventDefault();
      e.stopPropagation();
      presentStepRef.current(forward ? 1 : -1);
    };
    // leaving full screen (the browser's own Esc) ends presenting too
    const onFull = () => !document.fullscreenElement && setPresenting(false);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, [presenting, stopPresenting]);

  const presentLabel = lessonView && lesson
    ? `${lesson.title || 'Lesson'} · step ${lessonIndex + 1} of ${lesson.steps.length}`
    : journey
    ? `${journey.title} · stop ${stopIndex + 1} of ${journey.stops.length}`
    : studyList
      ? `${studyList.title} · ${listIndex + 1} of ${studyList.items.length}`
      : `${book.name} ${loc.chapter}${selectedVerse != null ? `:${selectedVerse}` : ''}`;

  return (
    <div className={`app${presenting ? ' presenting' : ''}${mapVisible ? '' : ' map-hidden'}${journey ? ' journey-active' : ''}${measure ? ' measuring' : ''}`}>
      <header className="topbar">
        <button className="brand" title="Ancient Pathfinder: back to reading" onClick={() => anyPage && leavePages()}>
          <picture className="brand-logo">
            <source srcSet={`${import.meta.env.BASE_URL}logo-mark-dark.png`} media="(prefers-color-scheme: dark)" />
            <img src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="" width={36} height={34} />
          </picture>
          <span className="brand-words">
            <span>ANCIENT</span>
            <span>PATHFINDER</span>
          </span>
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
          translation={translation}
          esvKey={esvKey}
          onGoTo={(b, c, v) => {
            leavePages();
            goTo(b, c, v);
          }}
          onOpenPerson={setPersonSlug}
          onOpenPlace={(i) => {
            leavePages();
            setMapVisible(true);
            setSelectedVerse(null);
            loadPlaces().then((ps) => {
              setPlaceOverride(ps[i]);
              setCardPlace(ps[i]);
            });
          }}
          onFollowJourney={(id, i) => {
            const j = allJourneys().find((x) => x.id === id);
            if (!j) return;
            leavePages();
            setPlaying(false);
            goToStop(j, i);
            setMapVisible(true);
          }}
          onOpenList={(id, i) => {
            leavePages();
            openList(id, i);
          }}
          onOpenPeriod={openPeriods}
          onOpenNation={openNations}
          onOpenSpot={openSpot}
        />
        <button
          className={`menu-btn${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <span className="menu-btn-code">{translation.label ?? translation.code.toUpperCase()}</span>
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
          {APIBIBLE_TRANSLATIONS.length > 0 && (
            <optgroup label="Licensed (through API.Bible)">
              {APIBIBLE_TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code === 'NASB1995' ? 'NASB 1995' : t.code} — {t.name}
                </option>
              ))}
            </optgroup>
          )}
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
        <PickerSelect
          className="journey-select"
          value={journeyId ?? ''}
          onChange={(v) => {
            const j = allJourneys().find((x) => x.id === v);
            setPlaying(false);
            setMenuOpen(false);
            if (j) {
              goToStop(j, 0);
              setMapVisible(true);
            } else setJourneyId(null);
          }}
          ariaLabel="Follow a journey"
          placeholder="Follow a journey…"
          clearLabel="Stop following the journey"
          groups={[
            // your own journeys first (signed in), then the built-in ones
            ...(showMine && myJourneys.length ? [{ label: 'My journeys', options: myJourneys.map((j) => ({ value: j.id, label: j.title })) }] : []),
            ...(['OT', 'NT'] as const).map((t) => ({
              label: t === 'OT' ? 'Old Testament' : 'New Testament',
              options: JOURNEYS.filter((j) => getBook(parseRef(j.stops[0].ref).book).testament === t).map((j) => ({
                value: j.id,
                label: j.title,
              })),
            })),
          ]}
        />
        </label>
        <label className="menu-field">
          <span className="menu-label">Study a list</span>
          <PickerSelect
            className="list-select"
            value={listId ?? ''}
            onChange={(v) => {
              setMenuOpen(false);
              openList(v);
            }}
            ariaLabel="Study a list"
            placeholder="Study a list…"
            clearLabel="Close the list"
            groups={[
              ...(showMine && myLists.length ? [{ label: 'My lists', options: myLists.map((l) => ({ value: l.id, label: l.title })) }] : []),
              ...LIST_GROUPS.map((g) => ({
                label: g,
                options: LISTS.filter((l) => l.group === g).map((l) => ({ value: l.id, label: l.title })),
              })),
            ]}
          />
        </label>
        <div className="topbar-actions">
          {NOTES_ENABLED && (
            <button
              className={`btn${notesOpen ? ' active' : ''}`}
              onClick={() => {
                setMenuOpen(false);
                if (notesOpen) closePeriods();
                else window.location.hash = 'notes';
              }}
              aria-pressed={notesOpen}
            >
              My Content
            </button>
          )}
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
              if (anyPage) {
                leavePages();
                setMapVisible(true);
              } else setMapVisible(!mapVisible);
            }}
            aria-pressed={mapVisible && !anyPage}
          >
            {mapVisible && !anyPage ? 'Hide map' : 'Show map'}
          </button>
          {ACCOUNTS_ENABLED && (
            <button
              className={`icon-btn account-btn${account.status === 'signed-in' ? ' on' : ''}`}
              onClick={() => {
                setMenuOpen(false);
                setAccountStart({ view: account.status === 'signed-in' ? 'account' : 'signin' });
              }}
              aria-label={account.status === 'signed-in' ? `Your account (${account.user?.username})` : 'Sign in'}
              title={account.status === 'signed-in' ? `Your account (${account.user?.username})` : 'Sign in'}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <circle cx="10" cy="6.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M3 18c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="narrow-only"> {account.status === 'signed-in' ? 'Your account' : 'Sign in'}</span>
            </button>
          )}
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
      {presenting && (
        <div className="present-bar" role="toolbar" aria-label="Presenting">
          <button className="present-step" onClick={() => presentStep(-1)} aria-label="Previous">
            ‹
          </button>
          <span className="present-where">{presentLabel}</span>
          <button className="present-step" onClick={() => presentStep(1)} aria-label="Next">
            ›
          </button>
          <span className="present-hint">← → or a clicker to step · Esc to finish</span>
          {NOTES_ENABLED && account.status === 'signed-in' && (
            <button
              className={`btn present-notes${presentNotes ? ' on' : ''}`}
              onClick={() => setPresentNotes(!presentNotes)}
              aria-pressed={presentNotes}
              title="Your notes are hidden while presenting unless you show them"
            >
              {presentNotes ? 'Hide my notes' : 'Show my notes'}
            </button>
          )}
          <button className="btn present-exit" onClick={stopPresenting}>
            Finish presenting
          </button>
        </div>
      )}

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
            const j = allJourneys().find((x) => x.id === id);
            if (!j) return;
            setPlaying(false);
            goToStop(j, 0);
            setMapVisible(true);
            closePeriods();
          }}
        />
      )}

      {jerusalemOpen && (
        <JerusalemPage
          focusId={spotFocus}
          onClose={closePeriods}
          onRead={(b, c, v) => {
            goTo(b, c, v);
            closePeriods();
          }}
        />
      )}

      {peopleOpen && <PeoplePage onClose={closePeriods} onOpenPerson={setPersonSlug} />}

      {privacyOpen && <PrivacyPage onClose={closePeriods} />}

      {notesOpen && (
        <PartBoundary onClose={closePeriods}>
        <Suspense fallback={null}>
          <NotesPage
            route={hash}
            translation={translation}
            onClose={closePeriods}
            onOpenRef={openSpan}
            signedIn={account.status === 'signed-in'}
            onSignIn={() => setAccountStart({ view: 'signin' })}
            onStartLesson={(nid) => {
              const n = notesStore.notes.find((x) => x.id === nid);
              if (!n) return;
              closePeriods();
              startLesson({ kind: 'mine', id: n.id, title: n.title ?? '', summary: n.summary ?? '', steps: n.steps ?? [], author: null });
            }}
            onFollowMine={(kind, nid) => {
              closePeriods();
              setMapVisible(true);
              if (kind === 'journey') {
                const j = allJourneys().find((x) => x.id === myId(nid));
                if (j) {
                  setPlaying(false);
                  goToStop(j, 0);
                }
              } else openList(myId(nid));
            }}
          />
        </Suspense>
        </PartBoundary>
      )}

      {lessonIntro && (
        <PartBoundary onClose={() => setLessonIntro(null)}>
          <Suspense fallback={null}>
            <LessonIntro
              lesson={lessonIntro}
              onStart={() => {
                setPresenting(false);
                setMapVisible(true);
                startLesson(lessonIntro);
                setLessonIntro(null);
              }}
              onCancel={() => {
                closeSharedLesson();
                setLessonIntro(null);
              }}
            />
          </Suspense>
        </PartBoundary>
      )}
      {lessonMsg && (
        <div className="modal-backdrop" onClick={() => setLessonMsg(null)}>
          <div className="modal acct" onClick={(e) => e.stopPropagation()} role="alert">
            <h2>Lesson</h2>
            <p>{lessonMsg}</p>
            <button className="btn primary" onClick={() => setLessonMsg(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      {verseNotesAtVerse != null && showNotes && (
        <PartBoundary onClose={() => setVerseNotesAtVerse(null)}>
        <Suspense fallback={null}>
          <VerseNotes
            osis={loc.book}
            chapter={loc.chapter}
            verse={verseNotesAtVerse}
            bookName={book.name}
            onClose={() => setVerseNotesAtVerse(null)}
            onOpenRef={openSpan}
            onOpenPage={(id) => {
              setVerseNotesAtVerse(null);
              window.location.hash = `notes/page/${id}`;
            }}
          />
        </Suspense>
        </PartBoundary>
      )}

      {accountStart && ACCOUNTS_ENABLED && (
        <PartBoundary onClose={() => setAccountStart(null)}>
        <Suspense fallback={null}>
          <AccountPanel
            // a new emailed link (or a new way in) starts the pop-up afresh
            key={accountStart.view + ('token' in accountStart ? accountStart.token.slice(0, 8) : '')}
            start={accountStart}
            onClose={() => setAccountStart(null)}
            onOpenRef={(b, c, v) => {
              setAccountStart(null);
              leavePages();
              goTo(b, c, v);
            }}
            onOpenPrivacy={() => window.open(`${window.location.pathname}#privacy`, '_blank', 'noopener')}
            preferences={
              <Preferences
                translationId={chosenTranslation.id}
                onTranslation={setTranslationId}
                map={mapSettings}
                onMap={setMapSettings}
              />
            }
          />
        </Suspense>
        </PartBoundary>
      )}

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

      {lesson && (
        <PartBoundary onClose={closeLesson}>
          <Suspense fallback={null}>
            <div className="lesson-page-wrap" hidden={!lessonView}>
              <LessonPage
                lesson={lesson}
                translation={translation}
                esvKey={esvKey}
                jump={lessonJump}
                current={lessonIndex}
                shown={lessonView}
                onIndex={setLessonIndex}
                onClose={closeLesson}
                onOpenRef={openSpan}
                onShowPlace={lessonShowPlace}
                onOpenPage={lessonAction}
                presenting={presenting}
                onPresent={startPresenting}
                signedIn={account.status === 'signed-in'}
                isAdmin={!!account.user?.isAdmin}
                onSaveCopy={async () => {
                  await saveSharedCopy();
                }}
                onRemoved={() => {
                  closeLesson();
                  setLessonMsg('The shared lesson was removed; its link no longer works.');
                }}
              />
            </div>
          </Suspense>
        </PartBoundary>
      )}

      <main className="layout" hidden={anyPage}>
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
                {account.status === 'signed-in' &&
                  (() => {
                    const ref = `${loc.book}.${loc.chapter}.${selectedVerse}`;
                    const saved = account.bookmarks.some((b) => b.ref === ref);
                    return (
                      <button
                        className={`word-study-btn bookmark-btn${saved ? ' on' : ''}`}
                        onClick={() => (saved ? removeBookmark(ref) : addBookmark(ref)).catch(() => {})}
                        title={saved ? 'Remove this bookmark' : 'Bookmark this verse'}
                        aria-pressed={saved}
                      >
                        {saved ? '★ Saved' : '☆ Save'}
                      </button>
                    );
                  })()}
                {showNotes &&
                  (() => {
                    const n =
                      verseNotesAt(loc.book, loc.chapter, selectedVerse, notesStore).length +
                      pagesMentioning(loc.book, loc.chapter, selectedVerse, notesStore).length;
                    return (
                      <button
                        className={`word-study-btn bookmark-btn note-btn${n ? ' has' : ''}`}
                        onClick={() => setVerseNotesAtVerse(selectedVerse)}
                        title={n ? `Your notes on this verse (${n})` : 'Write a note on this verse'}
                      >
                        {n ? `✎ Notes ${n}` : '✎ Note'}
                      </button>
                    );
                  })()}
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
              {selectedNations.length > 0 && (
                <div className="verse-info-people">
                  Nations:{' '}
                  {selectedNations.map((n, i, arr) => (
                    <button key={n.id} className="link" onClick={() => setNationId(n.id)}>
                      {n.name}
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
            onSelectNation={(v, id) => {
              setSelectedVerse(v);
              setNationId(id);
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
            onCompare={setCompareSet}
            onPresent={presenting ? undefined : startPresenting}
            period={currentPeriod ?? null}
            onOpenPeriod={openPeriods}
            noteMarks={chapterNoteMarks}
            onOpenNotes={(v) => {
              setSelectedVerse(v);
              setPlaceOverride(null);
              setVerseNotesAtVerse(v);
            }}
            before={
              <>
                {fallbackReason && (
                  <div className="text-notice">
                    <strong>Showing the World English Bible.</strong>{' '}
                    The {chosenTranslation.provider === 'esv' ? 'ESV' : chosenTranslation.code} service isn't available
                    right now ({fallbackReason}). Please try again in a little while.
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
              ) : translation.provider === 'apibible' ? (
                <p className="copyright-notice">
                  <strong>{translation.label ?? translation.code}</strong> · {translationNotice(translation)} Text provided by{' '}
                  <a href="https://api.bible" target="_blank" rel="noreferrer">
                    API.Bible
                  </a>{' '}
                  ·{' '}
                  <button type="button" className="link-button" onClick={() => setSettingsOpen(true)}>
                    Copyright details
                  </button>
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
          {lesson && !lessonShown && (
            <Suspense fallback={null}>
              <LessonReturn lesson={lesson} onBack={() => setLessonShown(true)} onClose={closeLesson} />
            </Suspense>
          )}
          {studyList && !lesson && (
            <ListPanel
              list={studyList}
              action={panelAction('list', studyList.id)}
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
              onOpenSpot={openSpot}
              area={
                studyList?.items[listIndex]?.area
                  ? { outlines: studyList.items[listIndex].area!, color: studyList.color }
                  : null
              }
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
                onOpenSpot={openSpot}
                legs={journeyLegs}
                action={panelAction('journey', journey.id)}
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
            leavePages();
            goTo(r.book, r.chapter, r.verse);
            if (isNarrow()) setPersonSlug(null);
          }}
          onOpenPlace={(at) => {
            leavePages();
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

      {compareSet && (
        <CompareGospels
          set={compareSet}
          translation={translation}
          esvKey={esvKey}
          fromBook={loc.book}
          onClose={() => setCompareSet(null)}
          onRead={(b, c, v) => {
            setCompareSet(null);
            goTo(b, c, v);
          }}
          onStep={(d) => {
            const i = PARALLELS.findIndex((s) => s.id === compareSet.id) + d;
            if (i >= 0 && i < PARALLELS.length) setCompareSet(PARALLELS[i]);
          }}
          startPresenting={presenting}
        />
      )}

      {nationId && (
        <NationCard
          id={nationId}
          onClose={() => setNationId(null)}
          onOpenPerson={setPersonSlug}
          onGoToRef={(ref) => {
            const r = parseRef(ref);
            leavePages();
            goTo(r.book, r.chapter, r.verse);
            if (isNarrow()) setNationId(null);
          }}
          onShowOnMap={(n) => {
            leavePages();
            setMapVisible(true);
            setSelectedVerse(null);
            setPlaceOverride({ index: -1, name: n.name, lat: n.lat, lon: n.lon, type: 'region', confidence: 50 });
            if (isNarrow()) setNationId(null);
          }}
          onOpenPage={(id) => {
            setNationId(null);
            openNations(id);
          }}
        />
      )}

      {cardPlace && (
        <PlaceCard
          place={cardPlace}
          onOpenPerson={setPersonSlug}
          onClose={() => setCardPlace(null)}
          onGoToRef={(ref) => goToRefForPlace(ref, cardPlace)}
          onOpenSpot={(id) => {
            setCardPlace(null);
            openSpot(id);
          }}
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
              {APIBIBLE_TRANSLATIONS.length > 0 && (
              <p>
                <strong>NASB 1995, CSB and NKJV.</strong> Provided through{' '}
                <a href="https://api.bible" target="_blank" rel="noreferrer">
                  API.Bible
                </a>{' '}
                (American Bible Society) under its free plan for non-commercial use. This app has no ads, charges nothing
                and asks for no donations. The text is shown as published, without footnotes or section headings. To keep
                within the plan, each chapter is kept for at most 30 days on the app's server so it doesn't have to be
                fetched again for every reader, only in memory on your device, and printing stops after 100 verses.
                When you read these translations, API.Bible's usage tracking (FUMS) records an anonymous view so the
                publishers can count how often their text is read; it doesn't include your name or anything you type.
              </p>
              )}
              {APIBIBLE_TRANSLATIONS.map((t) => (
                <p key={t.id}>
                  <strong>{t.code === 'NASB1995' ? 'NASB 1995' : t.code}.</strong> {translationNotice(t)}
                </p>
              ))}
              <p>
                <strong>Public-domain translations</strong> (WEB, KJV, ASV, BBE, Darby, YLT, OEB) are free to use
                without restriction, served by{' '}
                <a href="https://bible-api.com/" target="_blank" rel="noreferrer">
                  bible-api.com
                </a>
                . Verse search finds verses with the{' '}
                <a href="https://ebible.org/find/details.php?id=eng-web" target="_blank" rel="noreferrer">
                  World English Bible
                </a>{' '}
                (public domain, from eBible.org, unchanged) and then shows them in the translation you are reading.
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
                the editions used by most modern translations; words found only in the KJV's Greek are marked. Verse search
                also uses an index of the Hebrew and Greek words in each verse, built from the same STEPBible data, to
                find verses by meaning.
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
                in this app are original. The Gospel parallels (Compare the accounts), the Jerusalem and temple plans (and the
                city close-up on the map), the Passion Week walking routes and the Herod's dynasty chart were compiled and drawn for this app, after Scripture, Josephus and the
                Mishnah. Fonts: Figtree and EB Garamond (SIL Open Font License).
              </p>
              {ACCOUNTS_ENABLED && (
                <p>
                  <strong>Accounts</strong> are optional. What is kept, and who helps run them:{' '}
                  <a
                    href="#privacy"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Privacy & terms
                  </a>
                  .
                </p>
              )}
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
