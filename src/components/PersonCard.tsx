import { useEffect, useMemo, useState } from 'react';
import { BOOKS, getBook } from '../data/books';
import { PERIODS, periodFor } from '../data/periods';
import { formatOsis } from '../lib/placeInfo';
import FamilyTree from './FamilyTree';
import {
  bioParts,
  formatYear,
  loadPeople,
  loadPerson,
  type PersonDetails,
  type PersonEntry,
  type PlaceRef,
} from '../lib/people';

interface Props {
  slug: string;
  onClose: () => void;
  onOpenPerson: (slug: string) => void;
  onGoToRef: (ref: string) => void;
  onOpenPlace: (place: PlaceRef) => void;
}

const PREVIEW_BOOKS = 4;
const BIO_PREVIEW = 700;

export default function PersonCard({ slug, onClose, onOpenPerson, onGoToRef, onOpenPlace }: Props) {
  const [entry, setEntry] = useState<PersonEntry | null>(null);
  const [details, setDetails] = useState<PersonDetails | null>(null);
  const [people, setPeople] = useState<Map<string, PersonEntry>>(new Map());
  const [showAllRefs, setShowAllRefs] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);
  const [familyView, setFamilyView] = useState<'tree' | 'list'>('tree');

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setShowAllRefs(false);
    setShowFullBio(false);
    Promise.all([loadPeople(), loadPerson(slug)]).then(([idx, d]) => {
      if (cancelled) return;
      setPeople(idx.bySlug);
      setEntry(idx.bySlug.get(slug) ?? null);
      setDetails(d ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const refs = details?.refs ?? [];

  const refsByBook = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const r of refs) {
      const b = r.split('.')[0];
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b)!.push(r);
    }
    const order = new Map(BOOKS.map((b, i) => [b.osis, i]));
    return [...groups.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  }, [refs]);

  /** The period(s) of Bible history where this person appears most. */
  const periods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of refs) {
      const [b, c] = r.split('.');
      const p = periodFor(b, Number(c));
      if (p) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }
    const total = refs.length || 1;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([, n], i) => i === 0 || n / total >= 0.2)
      .slice(0, 2)
      .map(([id]) => PERIODS.find((p) => p.id === id)!);
  }, [refs]);

  const family: [string, string[] | undefined][] = details
    ? [
        ['Father', details.father],
        ['Mother', details.mother],
        [details.spouses && details.spouses.length > 1 ? 'Spouses' : 'Spouse', details.spouses],
        ['Brothers & sisters', details.siblings],
        ['Children', details.children],
      ]
    : [];
  const hasFamily = family.some(([, list]) => list?.length);

  const bio = details?.bio?.join('\n\n') ?? '';
  const bioShown = showFullBio || bio.length <= BIO_PREVIEW ? bio : bio.slice(0, BIO_PREVIEW).replace(/\s+\S*$/, '') + '…';
  const firstRef = refs[0];
  const title = entry?.title ?? details?.name ?? '';
  const shownBooks = showAllRefs ? refsByBook : refsByBook.slice(0, PREVIEW_BOOKS);
  const life =
    details?.born != null || details?.died != null
      ? `${details?.born != null ? `c. ${formatYear(details.born)}` : '?'} – ${
          details?.died != null ? `c. ${formatYear(details.died)}` : '?'
        }`
      : null;

  const personChip = (s: string) => {
    const p = people.get(s);
    return (
      <button key={s} className={`person-chip${p?.gender === 'F' ? ' f' : ''}`} onClick={() => onOpenPerson(s)}>
        {p?.title ?? s.replace(/_\d+$/, '')}
      </button>
    );
  };

  const placeLink = (at: PlaceRef) => (
    <button className="link" onClick={() => onOpenPlace(at)}>
      {at.name}
    </button>
  );

  return (
    <aside className="place-card person-card" aria-label={`About ${title}`}>
      <header className="pc-head">
        <div>
          <div className="pc-kicker">Person</div>
          <h2 className="pc-name">{title}</h2>
          <div className="pc-type">
            {entry?.gender === 'F' ? 'Woman' : entry?.gender === 'M' ? 'Man' : ''}
            {details?.groups?.length ? ` · ${details.groups.join(' · ')}` : ''}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close person info">
          ✕
        </button>
      </header>

      <div className="pc-body">
        {!details && <p className="muted small">Loading…</p>}
        {details && (
          <dl className="pc-facts">
            {details.aka?.length ? (
              <>
                <dt>Also called</dt>
                <dd>{details.aka.join(', ')}</dd>
              </>
            ) : null}
            {life && (
              <>
                <dt>Lived</dt>
                <dd>{life}</dd>
              </>
            )}
            {details.bornAt && (
              <>
                <dt>Born</dt>
                <dd>{placeLink(details.bornAt)}</dd>
              </>
            )}
            {details.diedAt && (
              <>
                <dt>Died</dt>
                <dd>{placeLink(details.diedAt)}</dd>
              </>
            )}
            {periods.length > 0 && (
              <>
                <dt>Period</dt>
                <dd>{periods.map((p) => `${p.n}. ${p.name}`).join(', ')}</dd>
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
            <dt>Mentioned</dt>
            <dd>
              {refs.length} {refs.length === 1 ? 'verse' : 'verses'} in {refsByBook.length}{' '}
              {refsByBook.length === 1 ? 'book' : 'books'}
            </dd>
          </dl>
        )}

        {hasFamily && (
          <section className="pc-section">
            <div className="pc-section-head">
              <h3>Family</h3>
              <div className="seg" role="tablist" aria-label="Family view">
                {(['tree', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={familyView === v}
                    className={familyView === v ? 'on' : ''}
                    onClick={() => setFamilyView(v)}
                  >
                    {v === 'tree' ? 'Tree' : 'List'}
                  </button>
                ))}
              </div>
            </div>
            {familyView === 'tree' && details && (
              <FamilyTree slug={slug} details={details} people={people} onOpenPerson={onOpenPerson} />
            )}
            {familyView === 'list' && (
            <dl className="pc-family">
              {family
                .filter(([, list]) => list?.length)
                .map(([label, list]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{list!.map(personChip)}</dd>
                  </div>
                ))}
            </dl>
            )}
          </section>
        )}

        {bio && (
          <section className="pc-section">
            <h3>Biography</h3>
            {bioShown.split('\n\n').map((para, i) => (
              <p key={i} className="pc-extract">
                {bioParts(para).map((part, j) =>
                  'ref' in part ? (
                    <button key={j} className="link bio-ref" onClick={() => onGoToRef(part.ref)}>
                      {part.text}
                    </button>
                  ) : (
                    <span key={j}>{part.text}</span>
                  ),
                )}
              </p>
            ))}
            {bio.length > BIO_PREVIEW && (
              <button className="link small" onClick={() => setShowFullBio(!showFullBio)}>
                {showFullBio ? 'Show less' : 'Read the full entry'}
              </button>
            )}
            <p className="muted small">From Easton's Bible Dictionary (1897).</p>
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
          Sources: Theographic Bible Metadata (CC BY-SA 4.0) · Easton's Bible Dictionary. Dates are traditional
          estimates.
        </footer>
      </div>
    </aside>
  );
}
