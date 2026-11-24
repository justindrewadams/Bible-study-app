import { Fragment, useEffect, useState } from 'react';
import { FAMILY_INFO, NATIONS, type Nation } from '../data/nations';
import { loadPeople, type PersonEntry } from '../lib/people';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  id: string;
  onClose: () => void;
  onOpenPerson: (slug: string) => void;
  onGoToRef: (ref: string) => void;
  onShowOnMap: (nation: Nation) => void;
  /** the full entry on the Nations page */
  onOpenPage: (id: string) => void;
}

/** A nation's card (side panel on desktop, bottom sheet on phones), like the place and person cards. */
export default function NationCard({ id, onClose, onOpenPerson, onGoToRef, onShowOnMap, onOpenPage }: Props) {
  const n = NATIONS.find((x) => x.id === id);
  const [people, setPeople] = useState<Map<string, PersonEntry>>(new Map());
  const [allHistory, setAllHistory] = useState(false);

  useEffect(() => {
    loadPeople().then(({ bySlug }) => setPeople(bySlug));
  }, []);
  useEffect(() => setAllHistory(false), [id]);

  if (!n) return null;
  const info = FAMILY_INFO[n.family];
  const personName = (slug: string) =>
    people.get(slug)?.name ?? slug.replace(/_\d+$/, '').replace(/^\w/, (c) => c.toUpperCase());
  const history = allHistory ? n.history : n.history.slice(0, 1);

  return (
    <aside className="place-card person-card nation-card" aria-label={`About ${n.name}`}>
      <header className="pc-head">
        <div>
          <div className="pc-kicker">Nation</div>
          <h2 className="pc-name">{n.name}</h2>
          <div className="pc-type">
            {info.label}
            {n.abraham && <> · Abraham’s family</>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close nation info">
          ✕
        </button>
      </header>

      <div className="pc-body">
        <dl className="pc-facts">
          {n.aka && (
            <>
              <dt>Also called</dt>
              <dd>{n.aka.join(', ')}</dd>
            </>
          )}
          <dt>Where</dt>
          <dd>
            {n.region}{' '}
            <button className="link" onClick={() => onShowOnMap(n)}>
              Show on map
            </button>
          </dd>
        </dl>

        <section className="pc-section">
          <h3>Origin</h3>
          <p className="pc-extract">{n.origin}</p>
          {n.line && (
            <div className="nation-line" aria-label="Family line">
              {n.line.map((slug, i) => (
                <Fragment key={slug}>
                  {i > 0 && <span className="nl-arrow">›</span>}
                  <button
                    className={`pchip nl-person${i === n.line!.length - 1 ? ' founder' : ''}`}
                    onClick={() => onOpenPerson(slug)}
                    title={`Open ${personName(slug)}`}
                  >
                    {personName(slug)}
                  </button>
                </Fragment>
              ))}
            </div>
          )}
        </section>

        <section className="pc-section">
          <h3>History</h3>
          {history.map((p, i) => (
            <p key={i} className="pc-extract">
              {p}
            </p>
          ))}
          {n.history.length > 1 && (
            <button className="link small" onClick={() => setAllHistory(!allHistory)}>
              {allHistory ? 'Show less' : 'Read more'}
            </button>
          )}
        </section>

        <section className="pc-section">
          <h3>Key verses</h3>
          <ul className="pc-stories">
            {n.refs.map((r) => (
              <li key={r.ref}>
                <button onClick={() => onGoToRef(r.ref)}>
                  <span>{r.t}</span>
                  <span className="pc-ref">{formatOsis(r.ref)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button className="pc-measure" onClick={() => onOpenPage(n.id)}>
          Open on the Nations page ›
        </button>
        <p className="muted small">Summaries are written for this app.</p>
      </div>
    </aside>
  );
}
