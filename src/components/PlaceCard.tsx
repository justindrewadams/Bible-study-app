import { useEffect, useMemo, useState } from 'react';
import { BOOKS, getBook } from '../data/books';
import type { Place } from '../lib/geo';
import { JOURNEYS, type Journey } from '../lib/journeys';
import { formatOsis, loadPlaceDetails, loadWikiInfo, type PlaceDetails, type WikiInfo } from '../lib/placeInfo';
import { loadPeople, loadPlacePeople, type PersonEntry } from '../lib/people';

interface Props {
  place: Place;
  onClose: () => void;
  onGoToRef: (ref: string) => void;
  onFollowJourney: (journey: Journey, stopIndex: number) => void;
  onOpenPerson: (slug: string) => void;
}

function likelihood(score: number) {
  if (score >= 90) return 'certain';
  if (score >= 60) return 'very likely';
  if (score >= 30) return 'likely';
  if (score >= 10) return 'possible';
  return 'less likely';
}

const PREVIEW_BOOKS = 4;

export default function PlaceCard({ place, onClose, onGoToRef, onFollowJourney, onOpenPerson }: Props) {
  const [natives, setNatives] = useState<{ born: PersonEntry[]; died: PersonEntry[] }>({ born: [], died: [] });
  useEffect(() => {
    let cancelled = false;
    setNatives({ born: [], died: [] });
    Promise.all([loadPlacePeople(), loadPeople()]).then(([pp, { bySlug }]) => {
      if (cancelled) return;
      const at = pp[place.index] ?? {};
      const get = (l?: string[]) => (l ?? []).map((s) => bySlug.get(s)!).filter(Boolean);
      setNatives({ born: get(at.born), died: get(at.died) });
    });
    return () => {
      cancelled = true;
    };
  }, [place.index]);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [wiki, setWiki] = useState<WikiInfo | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [showAllRefs, setShowAllRefs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setWiki(null);
    setShowAllRefs(false);
    loadPlaceDetails().then((all) => {
      if (cancelled) return;
      const d = all[place.index];
      setDetails(d);
      if (d?.wd) {
        setWikiLoading(true);
        loadWikiInfo(d.wd)
          .then((w) => !cancelled && setWiki(w))
          .finally(() => !cancelled && setWikiLoading(false));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [place.index]);

  const journeyStops = useMemo(
    () =>
      JOURNEYS.flatMap((journey) =>
        journey.stops
          .map((stop, stopIndex) => ({ journey, stop, stopIndex }))
          .filter(({ stop }) => stop.placeIndex === place.index),
      ),
    [place.index],
  );

  const refsByBook = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const r of details?.refs ?? []) {
      const b = r.split('.')[0];
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b)!.push(r);
    }
    const order = new Map(BOOKS.map((b, i) => [b.osis, i]));
    return [...groups.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  }, [details]);

  const refs = details?.refs ?? [];
  const firstRef = refsByBook[0]?.[1][0];
  const shownBooks = showAllRefs ? refsByBook : refsByBook.slice(0, PREVIEW_BOOKS);

  return (
    <aside className="place-card" aria-label={`About ${place.name}`}>
      <header className="pc-head">
        <div>
          <h2 className="pc-name">{place.name}</h2>
          <div className="pc-type">{(details?.types ?? [place.type]).join(' · ')}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close place info">
          ✕
        </button>
      </header>

      <div className="pc-body">
        {wiki?.thumbnail && <img className="pc-img" src={wiki.thumbnail} alt={wiki.title ?? place.name} />}

        <dl className="pc-facts">
          {details?.modern?.length ? (
            <>
              <dt>Today</dt>
              <dd>
                {details.modern.map(([name, score], i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    {name} <span className="muted">({likelihood(score)})</span>
                  </span>
                ))}
              </dd>
            </>
          ) : details?.site ? (
            <>
              <dt>Location</dt>
              <dd>{details.site}</dd>
            </>
          ) : null}
          {details?.aka?.length ? (
            <>
              <dt>Also called</dt>
              <dd>{details.aka.join(', ')}</dd>
            </>
          ) : null}
          {details?.alt?.length ? (
            <>
              <dt>Also spelled</dt>
              <dd>{details.alt.join(', ')}</dd>
            </>
          ) : null}
          {wiki?.established && (
            <>
              <dt>Established</dt>
              <dd>{wiki.established}</dd>
            </>
          )}
          {firstRef && (
            <>
              <dt>First named</dt>
              <dd>
                <button className="link" onClick={() => onGoToRef(firstRef)}>
                  {formatOsis(firstRef)}
                </button>
              </dd>
            </>
          )}
          {details && (
            <>
              <dt>Mentioned</dt>
              <dd>
                {refs.length} {refs.length === 1 ? 'verse' : 'verses'} in {refsByBook.length}{' '}
                {refsByBook.length === 1 ? 'book' : 'books'}
              </dd>
            </>
          )}
        </dl>

        {(wiki?.extract || wikiLoading) && (
          <section className="pc-section">
            <h3>History</h3>
            {wiki?.extract ? (
              <>
                <p className="pc-extract">{wiki.extract}</p>
                {wiki.url && (
                  <a className="small" href={wiki.url} target="_blank" rel="noreferrer">
                    Read more on Wikipedia ↗
                  </a>
                )}
              </>
            ) : (
              <p className="muted small">Loading…</p>
            )}
          </section>
        )}

        {details?.stories?.length ? (
          <section className="pc-section">
            <h3>Key stories</h3>
            <ul className="pc-stories">
              {details.stories.map((s) => (
                <li key={s.ref + s.t}>
                  <button onClick={() => onGoToRef(s.ref)}>
                    <span>{s.t}</span>
                    <span className="pc-ref">{formatOsis(s.ref)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {journeyStops.length > 0 && (
          <section className="pc-section">
            <h3>On these journeys</h3>
            <ul className="pc-stories">
              {journeyStops.map(({ journey, stop, stopIndex }) => (
                <li key={journey.id + stopIndex}>
                  <button onClick={() => onFollowJourney(journey, stopIndex)}>
                    <span>
                      <span className="pc-dot" style={{ background: journey.color }} />
                      <strong>{journey.title}</strong>, stop {stopIndex + 1}: {stop.note}
                    </span>
                    <span className="pc-ref">{formatOsis(stop.ref)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(natives.born.length > 0 || natives.died.length > 0) && (
          <section className="pc-section">
            <h3>People</h3>
            <dl className="pc-family">
              {(
                [
                  ['Born here', natives.born],
                  ['Died here', natives.died],
                ] as const
              )
                .filter(([, l]) => l.length)
                .map(([label, l]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {l.map((p) => (
                        <button
                          key={p.slug}
                          className={`person-chip${p.gender === 'F' ? ' f' : ''}`}
                          onClick={() => onOpenPerson(p.slug)}
                        >
                          {p.title}
                        </button>
                      ))}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {refsByBook.length > 0 && (
          <section className="pc-section">
            <h3>Every reference</h3>
            {shownBooks.map(([book, list]) => (
              <div key={book} className="pc-book">
                <div className="pc-book-name">
                  {getBook(book).name} <span className="muted">({list.length})</span>
                </div>
                <div className="pc-chips">
                  {list.map((r) => {
                    const [, c, v] = r.split('.');
                    return (
                      <button key={r} className="pc-chip" onClick={() => onGoToRef(r)} title={formatOsis(r)}>
                        {c}:{v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {refsByBook.length > PREVIEW_BOOKS && (
              <button className="link small" onClick={() => setShowAllRefs(!showAllRefs)}>
                {showAllRefs ? 'Show fewer' : `Show all ${refsByBook.length} books`}
              </button>
            )}
          </section>
        )}

        <footer className="pc-sources small muted">
          Sources: OpenBible.info
          {details?.factbook && (
            <>
              {' · '}
              <a href={details.factbook} target="_blank" rel="noreferrer">
                Faithlife Factbook
              </a>
            </>
          )}
          {details?.pleiades && (
            <>
              {' · '}
              <a href={details.pleiades} target="_blank" rel="noreferrer">
                Pleiades
              </a>
            </>
          )}
          {wiki?.url && ' · Wikipedia, Wikidata'}
        </footer>
      </div>
    </aside>
  );
}
