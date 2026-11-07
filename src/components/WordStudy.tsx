import { useEffect, useMemo, useState } from 'react';
import { getBook } from '../data/books';
import { formatOsis } from '../lib/placeInfo';
import {
  cleanGloss,
  describeGrammar,
  loadLexEntry,
  loadVerseWords,
  sameRoot,
  strongLabel,
  type LexEntry,
  type Word,
} from '../lib/words';

interface Props {
  book: string;
  chapter: number;
  verse: number;
  onClose: () => void;
  /** jump the reader to another verse (the card stays open on that verse) */
  onGoToRef: (ref: string) => void;
}

const PREVIEW_BOOKS = 4;

/** Word-by-word Hebrew or Greek for one verse, with a dictionary entry for each word. */
export default function WordStudy({ book, chapter, verse, onClose, onGoToRef }: Props) {
  const hebrew = getBook(book).testament === 'OT';
  const [words, setWords] = useState<Word[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  // after jumping from "other verses", the word being followed is marked in the new verse
  const [following, setFollowing] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setWords(null);
    setPicked(null);
    loadVerseWords(book, chapter, verse).then((w) => live && setWords(w));
    return () => {
      live = false;
    };
  }, [book, chapter, verse]);

  const word = picked != null ? words?.[picked] : undefined;
  const ref = `${getBook(book).name} ${chapter}:${verse}`;

  return (
    <aside className="place-card person-card word-card" aria-label={`${hebrew ? 'Hebrew' : 'Greek'} words of ${ref}`}>
      <header className="pc-head">
        <div>
          <div className="pc-kicker">{hebrew ? 'Hebrew' : 'Greek'}</div>
          <h2 className="pc-name">{ref}</h2>
          <div className="pc-type">{word ? 'Word study' : 'Word by word'}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close word study">
          ✕
        </button>
      </header>

      <div className="pc-body">
        {!words && <p className="muted small">Loading…</p>}
        {words && words.length === 0 && <p className="muted small">No original-language words found for this verse.</p>}

        {words && words.length > 0 && !word && (
          <>
            <p className="muted small ws-hint">
              {hebrew ? 'Hebrew reads right to left; the words are listed here in reading order. ' : ''}Tap a word to
              see its meaning, grammar and other verses that use it.
            </p>
            <ol className="ws-list">
              {words.map((w, i) => (
                <li key={i}>
                  <button
                    className={`ws-word${w.kjvOnly ? ' kjv' : ''}${following && sameRoot(following, w.strong) ? ' following' : ''}`}
                    onClick={() => setPicked(i)}
                  >
                    <span className={`ws-orig${hebrew ? ' he' : ' gr'}`} lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>
                      {w.word}
                    </span>
                    <span className="ws-tr">{w.translit}</span>
                    <span className="ws-gloss">{cleanGloss(w.gloss)}</span>
                    <span className="ws-strong">{w.strong ? strongLabel(w.strong) : ''}</span>
                    {w.kjvOnly && <span className="ws-kjv">KJV text only</span>}
                  </button>
                </li>
              ))}
            </ol>
            {words.some((w) => w.kjvOnly) && (
              <p className="muted small">
                Faded words appear in the Greek behind the KJV (the Textus Receptus) but not in the editions most
                modern translations follow.
              </p>
            )}
          </>
        )}

        {word && (
          <WordDetail
            word={word}
            hebrew={hebrew}
            here={`${book}.${chapter}.${verse}`}
            onBack={() => setPicked(null)}
            onGoToRef={(r) => {
              setFollowing(word.strong);
              onGoToRef(r);
            }}
          />
        )}

        <footer className="pc-sources small muted">
          Hebrew and Greek words, glosses, grammar and lexicon: STEPBible.org (Tyndale House, Cambridge), CC BY 4.0.
          Lexicon entries are based on Brown-Driver-Briggs and Abbott-Smith.
        </footer>
      </div>
    </aside>
  );
}

function WordDetail({
  word,
  hebrew,
  here,
  onBack,
  onGoToRef,
}: {
  word: Word;
  hebrew: boolean;
  here: string;
  onBack: () => void;
  onGoToRef: (ref: string) => void;
}) {
  const [entry, setEntry] = useState<LexEntry | null | undefined>(undefined);
  const [grammar, setGrammar] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    setEntry(undefined);
    setShowAll(false);
    loadLexEntry(word.strong).then((e) => live && setEntry(e));
    describeGrammar(word.grammar, word.strong).then((g) => live && setGrammar(g));
    return () => {
      live = false;
    };
  }, [word]);

  const byBook = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of entry?.refs ?? []) {
      const b = r.split('.')[0];
      if (!m.has(b)) m.set(b, []);
      m.get(b)!.push(r);
    }
    return [...m.entries()];
  }, [entry]);
  const shownBooks = showAll ? byBook : byBook.slice(0, PREVIEW_BOOKS);

  return (
    <div className="ws-detail">
      <button className="link small ws-back" onClick={onBack}>
        ‹ All words in this verse
      </button>

      <div className="ws-head">
        <span className={`ws-big${hebrew ? ' he' : ' gr'}`} lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>
          {entry?.lemma ?? word.word}
        </span>
        <div>
          <div className="ws-head-tr">{(entry?.translit ?? word.translit).replace(/\./g, '')}</div>
          <div className="ws-head-gloss">{entry?.gloss ?? cleanGloss(word.gloss)}</div>
        </div>
      </div>

      <dl className="pc-facts">
        <dt>Strong's</dt>
        <dd>{strongLabel(word.strong)}</dd>
        <dt>In this verse</dt>
        <dd>
          <span lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'} className={hebrew ? 'he' : 'gr'}>
            {word.word}
          </span>{' '}
          “{cleanGloss(word.gloss)}”
        </dd>
        {grammar && (
          <>
            <dt>Grammar</dt>
            <dd>{grammar}</dd>
          </>
        )}
        {entry && (
          <>
            <dt>Used in</dt>
            <dd>
              {entry.verseCount.toLocaleString()} {entry.verseCount === 1 ? 'verse' : 'verses'}
            </dd>
          </>
        )}
      </dl>

      {entry === undefined && <p className="muted small">Loading the dictionary entry…</p>}
      {entry === null && <p className="muted small">No dictionary entry for this word.</p>}

      {entry && entry.definition.length > 0 && (
        <section className="pc-section">
          <h3>Dictionary</h3>
          <p className={`ws-def${hebrew ? '' : ' greek-def'}`}>
            {entry.definition.map((seg, i) =>
              seg[0] === '\n' && seg.length === 1 ? (
                <br key={i} />
              ) : seg[1] === 'r' ? (
                <button key={i} className="link bio-ref" onClick={() => onGoToRef(seg[2]!)}>
                  {seg[0]}
                </button>
              ) : seg[1] === 'b' ? (
                <strong key={i}>{seg[0]}</strong>
              ) : seg[1] === 'i' ? (
                <em key={i}>{seg[0]}</em>
              ) : (
                <span key={i}>{seg[0]}</span>
              ),
            )}
          </p>
        </section>
      )}

      {entry && byBook.length > 0 && (
        <section className="pc-section">
          <h3>Other verses using this word</h3>
          {entry.verseCount > entry.refs.length && (
            <p className="muted small">The first {entry.refs.length} of {entry.verseCount.toLocaleString()} verses.</p>
          )}
          {shownBooks.map(([b, list]) => (
            <div key={b} className="pc-book">
              <div className="pc-book-name">
                {getBook(b).name} <span className="muted">({list.length})</span>
              </div>
              <div className="pc-chips">
                {list.map((r) => {
                  const [, c, v] = r.split('.');
                  return (
                    <button
                      key={r}
                      className={`pc-chip${r === here ? ' here' : ''}`}
                      onClick={() => onGoToRef(r)}
                      title={formatOsis(r)}
                    >
                      {c}:{v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {byBook.length > PREVIEW_BOOKS && (
            <button className="link small" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${byBook.length} books`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
