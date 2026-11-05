import { useEffect, useState } from 'react';
import { loadPerson, type PersonDetails, type PersonEntry } from '../lib/people';

interface Props {
  slug: string;
  details: PersonDetails;
  people: Map<string, PersonEntry>;
  onOpenPerson: (slug: string) => void;
}

interface Tree {
  grandparents: { side: 'father' | 'mother'; slugs: string[] }[];
  grandchildren: Map<string, string[]>; // child slug -> their children
}

const MAX_CHILDREN = 12;
const MAX_GRANDCHILDREN = 4;

/** A generational chart: grandparents → parents → person & spouses → children → grandchildren. */
export default function FamilyTree({ slug, details, people, onOpenPerson }: Props) {
  const [tree, setTree] = useState<Tree | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTree(null);
    const fathers = details.father ?? [];
    const mothers = details.mother ?? [];
    const kids = (details.children ?? []).slice(0, MAX_CHILDREN);
    Promise.all([
      Promise.all(fathers.map(loadPerson)),
      Promise.all(mothers.map(loadPerson)),
      Promise.all(kids.map(loadPerson)),
    ]).then(([fd, md, kd]) => {
      if (cancelled) return;
      const parentsOf = (d?: PersonDetails) => [...(d?.father ?? []), ...(d?.mother ?? [])];
      const gpFather = [...new Set(fd.flatMap(parentsOf))];
      const gpMother = [...new Set(md.flatMap(parentsOf))];
      const grandchildren = new Map<string, string[]>();
      kids.forEach((k, i) => {
        const gc = kd[i]?.children ?? [];
        if (gc.length) grandchildren.set(k, gc);
      });
      setTree({
        grandparents: [
          { side: 'father' as const, slugs: gpFather },
          { side: 'mother' as const, slugs: gpMother },
        ].filter((g) => g.slugs.length),
        grandchildren,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, details]);

  const node = (s: string, extra = '') => {
    const p = people.get(s);
    return (
      <button
        key={s + extra}
        className={`ft-node${p?.gender === 'F' ? ' f' : ''}${extra}`}
        onClick={() => onOpenPerson(s)}
        title={p?.title}
      >
        {p?.title ?? s.replace(/_\d+$/, '')}
      </button>
    );
  };

  const parents = [...(details.father ?? []), ...(details.mother ?? [])];
  const spouses = details.spouses ?? [];
  const siblings = details.siblings ?? [];
  const children = details.children ?? [];
  const self = people.get(slug);

  return (
    <div className="family-tree" aria-label="Family tree">
      {tree && tree.grandparents.length > 0 && (
        <div className="ft-gen">
          <div className="ft-label">Grandparents</div>
          <div className="ft-row">
            {tree.grandparents.map((g) => (
              <div key={g.side} className="ft-group">
                {g.slugs.map((s) => node(s))}
                <span className="ft-side">{g.side === 'father' ? "father's side" : "mother's side"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {parents.length > 0 && (
        <div className="ft-gen">
          <div className="ft-label">Parents</div>
          <div className="ft-row">
            <div className="ft-group couple">{parents.map((s) => node(s))}</div>
          </div>
        </div>
      )}

      <div className="ft-gen ft-center">
        <div className="ft-row">
          {siblings.length > 0 && (
            <div className="ft-group ft-siblings">
              {siblings.slice(0, 8).map((s) => node(s, ' sib'))}
              {siblings.length > 8 && <span className="ft-more">+{siblings.length - 8} more</span>}
              <span className="ft-side">brothers & sisters</span>
            </div>
          )}
          <div className="ft-group couple">
            <span className={`ft-node self${self?.gender === 'F' ? ' f' : ''}`}>{self?.title ?? details.name}</span>
            {spouses.length > 0 && <span className="ft-marry" aria-label="married to">&amp;</span>}
            {spouses.map((s) => node(s, ' spouse'))}
          </div>
        </div>
      </div>

      {children.length > 0 && (
        <div className="ft-gen">
          <div className="ft-label">Children</div>
          <div className="ft-row ft-children">
            {children.slice(0, MAX_CHILDREN).map((c) => {
              const gc = tree?.grandchildren.get(c) ?? [];
              return (
                <div key={c} className="ft-branch">
                  {node(c)}
                  {gc.length > 0 && (
                    <div className="ft-grand">
                      {gc.slice(0, MAX_GRANDCHILDREN).map((g) => node(g, ' small'))}
                      {gc.length > MAX_GRANDCHILDREN && (
                        <span className="ft-more">+{gc.length - MAX_GRANDCHILDREN}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {children.length > MAX_CHILDREN && (
              <span className="ft-more">+{children.length - MAX_CHILDREN} more children</span>
            )}
          </div>
          {tree && tree.grandchildren.size > 0 && (
            <div className="ft-side ft-label-below">Smaller boxes under a child are their children (grandchildren).</div>
          )}
        </div>
      )}

      <p className="ft-hint muted small">Tap anyone to open their page and see their family.</p>
    </div>
  );
}
