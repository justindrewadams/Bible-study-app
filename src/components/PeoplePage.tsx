import { useEffect, useMemo, useRef, useState } from 'react';
import { getBook } from '../data/books';
import { loadPeople, type PersonEntry } from '../lib/people';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  onOpenPerson: (slug: string) => void;
  onClose: () => void;
}

type Gender = 'all' | 'M' | 'F';
type Testament = 'all' | 'OT' | 'NT';
type Sort = 'count' | 'az';

const PAGE = 120;

export default function PeoplePage({ onOpenPerson, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<PersonEntry[]>([]);
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<Gender>('all');
  const [testament, setTestament] = useState<Testament>('all');
  const [sort, setSort] = useState<Sort>('count');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    loadPeople().then(({ list }) => setPeople(list));
  }, []);

  useEffect(() => setLimit(PAGE), [query, gender, testament, sort]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = people.filter((p) => {
      if (!p.count) return false;
      if (gender !== 'all' && p.gender !== gender) return false;
      if (testament !== 'all' && getBook(p.firstRef.split('.')[0]).testament !== testament) return false;
      return !q || p.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    });
    return out.sort((a, b) =>
      sort === 'az' ? a.title.localeCompare(b.title) : b.count - a.count || a.title.localeCompare(b.title),
    );
  }, [people, query, gender, testament, sort]);

  const filtering = query !== '' || gender !== 'all' || testament !== 'all' || sort !== 'count';

  return (
    <div className="periods-page people-page" ref={ref}>
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Back to reading
        </button>
        <span className="bar-title">People of the Bible</span>
      </div>

      <section className="hero people-hero">
        <div className="hero-text">
          <h1>People of the Bible</h1>
          <p>
            Search {people.length ? people.filter((p) => p.count).length.toLocaleString() : 'about 3,000'} people named
            in Scripture.{' '}
            <span className="hero-more">
              Each page shows their family, where they were born and died, the period they lived in, a biography, and
              every verse that names them.
            </span>
          </p>
        </div>
      </section>

      <div className="periods-inner">
        <div className="filter-bar" role="search">
          <label className="search-box">
            <input
              type="search"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search people"
              autoFocus={!window.matchMedia('(max-width: 860px)').matches}
            />
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </label>
          <span className="filter-label">Filter</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} aria-label="Men or women">
            <option value="all">Everyone</option>
            <option value="M">Men</option>
            <option value="F">Women</option>
          </select>
          <select value={testament} onChange={(e) => setTestament(e.target.value as Testament)} aria-label="Testament">
            <option value="all">All books</option>
            <option value="OT">Old Testament</option>
            <option value="NT">New Testament</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="count">Top named</option>
            <option value="az">A–Z</option>
          </select>
          <button
            className="clear-link"
            disabled={!filtering}
            onClick={() => {
              setQuery('');
              setGender('all');
              setTestament('all');
              setSort('count');
            }}
          >
            Clear
          </button>
        </div>

        <p className="result-count">
          {shown.length.toLocaleString()} {shown.length === 1 ? 'person' : 'people'}
        </p>

        <div className="people-grid">
          {shown.slice(0, limit).map((p) => (
            <button key={p.slug} className={`person-tile${p.gender === 'F' ? ' f' : ''}`} onClick={() => onOpenPerson(p.slug)}>
              <span className="pt-name">{p.title}</span>
              <span className="pt-meta">
                {p.count} {p.count === 1 ? 'verse' : 'verses'} · first in {formatOsis(p.firstRef)}
              </span>
            </button>
          ))}
        </div>
        {shown.length > limit && (
          <button className="btn show-more" onClick={() => setLimit(limit + PAGE * 2)}>
            Show more ({(shown.length - limit).toLocaleString()} left)
          </button>
        )}

        <p className="muted small periods-foot">
          People, family links and dates from Theographic Bible Metadata (CC BY-SA 4.0); biographies from Easton's Bible
          Dictionary (1897). Some people share a name. Check the details on each page.
        </p>
      </div>
    </div>
  );
}
