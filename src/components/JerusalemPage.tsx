import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SPOTS, spotById, type Spot } from '../data/jerusalem';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  /** a spot to select and scroll to (from #jerusalem/<id>) */
  focusId: string | null;
  onClose: () => void;
  onRead: (book: string, chapter: number, verse: number) => void;
}

/** A tappable area of a plan. */
function Hot({ id, sel, onPick, children, label }: { id: string; sel: string | null; onPick: (id: string) => void; children: ReactNode; label: string }) {
  return (
    <g
      className={`jh${sel === id ? ' on' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={sel === id}
      onClick={() => onPick(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(id);
        }
      }}
    >
      {children}
    </g>
  );
}

/** The city in Jesus' day, north at the top. Drawn for this app; positions are approximate. */
function CityPlan({ sel, onPick }: { sel: string | null; onPick: (id: string) => void }) {
  const h = (id: string, label: string, el: ReactNode) => (
    <Hot id={id} sel={sel} onPick={onPick} label={label}>
      {el}
    </Hot>
  );
  return (
    <svg viewBox="0 0 640 540" className="jplan" role="img" aria-label="Plan of Jerusalem in Jesus' day">
      {/* valleys */}
      {h('hinnom', 'Hinnom Valley', <path className="j-valley" d="M118 120 C 96 220 102 360 140 455 C 190 520 330 528 452 500" />)}
      {h('kidron', 'Kidron Valley', <path className="j-valley" d="M486 40 C 482 160 478 300 470 380 C 464 440 458 480 452 500" />)}
      <path className="j-valley minor" d="M300 120 C 318 230 336 360 356 470" />
      <text className="j-small" x="318" y="300" transform="rotate(78 318 300)">Tyropoeon Valley</text>

      {/* Mount of Olives */}
      {h(
        'olives',
        'Mount of Olives',
        <>
          <path className="j-hill" d="M548 70 C 600 150 606 330 560 470 L 640 470 L 640 70 Z" />
          <path className="j-contour" d="M572 110 C 612 190 614 320 582 430" />
          <text className="j-label" x="594" y="260" transform="rotate(90 594 260)">Mount of Olives</text>
        </>,
      )}

      {/* walls: the first wall around the Upper and Lower City, the second wall to the north */}
      <path className="j-wall" d="M150 196 L 132 300 L 150 420 L 230 452 L 330 476 L 372 478 L 420 420 L 452 342" />
      <path className="j-wall" d="M150 196 L 200 186 L 262 176 L 330 152" />
      <path className="j-wall second" d="M262 176 L 252 120 L 300 92 L 338 100" />

      {/* districts */}
      {h('upper-city', 'The Upper City', <><path className="j-district" d="M156 210 L 290 192 L 318 300 L 330 456 L 232 440 L 158 410 L 142 300 Z" /><text className="j-district-name" x="226" y="330">UPPER CITY</text></>)}
      {h('lower-city', 'The Lower City', <><path className="j-district" d="M340 352 L 448 348 L 416 420 L 370 470 L 340 462 Z" /><text className="j-district-name" x="352" y="400">LOWER</text><text className="j-district-name" x="358" y="414">CITY</text></>)}

      {/* temple mount and Antonia */}
      {h('temple-mount', 'The temple', <><path className="j-temple" d="M330 132 L 456 126 L 452 342 L 340 346 Z" /><rect className="j-sanctuary" x="372" y="190" width="40" height="70" /><text className="j-label" x="352" y="300">Temple</text></>)}
      {h('antonia', 'Fortress Antonia', <><rect className="j-building" x="326" y="104" width="54" height="34" /><text className="j-small" x="326" y="98">Antonia</text></>)}

      {/* palaces and houses */}
      {h('herods-palace', 'Herod’s palace, the praetorium', <><rect className="j-building" x="146" y="214" width="46" height="96" /><circle className="j-building" cx="152" cy="212" r="7" /><circle className="j-building" cx="170" cy="210" r="7" /><circle className="j-building" cx="188" cy="212" r="7" /><text className="j-small" x="200" y="296">Herod’s palace</text><text className="j-small" x="200" y="312">(praetorium)</text></>)}
      {h('hasmonean-palace', 'Herod Antipas’ quarters', <><rect className="j-building" x="276" y="236" width="30" height="22" /><text className="j-small" x="244" y="230">Antipas</text></>)}
      {h('high-priest', 'The high priest’s house', <><rect className="j-building" x="270" y="404" width="26" height="22" /><text className="j-small" x="236" y="398">High priest</text></>)}
      {h('upper-room', 'The upper room', <><rect className="j-building" x="190" y="414" width="24" height="20" /><text className="j-small" x="166" y="452">Upper room</text></>)}

      {/* pools */}
      {h('bethesda', 'Pool of Bethesda', <><rect className="j-pool" x="396" y="76" width="34" height="22" /><text className="j-small" x="434" y="92">Bethesda</text></>)}
      {h('siloam', 'Pool of Siloam', <><rect className="j-pool" x="352" y="480" width="30" height="18" /><text className="j-small" x="386" y="496">Siloam</text></>)}

      {/* outside the walls */}
      {h('golgotha', 'Golgotha', <><path className="j-golgotha" d="M222 124 l 12 -20 l 12 20 Z" /><text className="j-small" x="200" y="140">Golgotha</text></>)}
      {h('tomb', 'The garden tomb', <><circle className="j-tomb" cx="206" cy="110" r="7" /><text className="j-small" x="168" y="96">Tomb</text></>)}
      {h('gethsemane', 'Gethsemane', <><circle className="j-garden" cx="516" cy="206" r="13" /><text className="j-small" x="492" y="182">Gethsemane</text></>)}

      {/* roads */}
      <path className="j-road" d="M456 236 C 500 236 560 226 640 222" />
      <text className="j-small muted" x="574" y="252" textAnchor="middle">to Bethany & Jericho ›</text>
      <path className="j-road" d="M146 250 L 0 240" />
      <text className="j-small muted" x="8" y="232">‹ to Emmaus & Joppa</text>
      <path className="j-road" d="M150 420 L 40 540" />
      <text className="j-small muted" x="20" y="512">‹ to Bethlehem</text>

      {/* labels for the valleys, compass and scale */}
      <text className="j-small" x="474" y="474" transform="rotate(-84 474 474)">Kidron Valley</text>
      <text className="j-small" x="140" y="500" transform="rotate(22 140 500)">Hinnom Valley</text>
      <g className="j-compass" transform="translate(40 50)">
        <path d="M0 18 L 8 -14 L 16 18 L 8 10 Z" />
        <text x="8" y="-20" textAnchor="middle">N</text>
      </g>
      <g className="j-scale" transform="translate(470 528)">
        <line x1="0" y1="0" x2="150" y2="0" />
        <line x1="0" y1="-5" x2="0" y2="5" />
        <line x1="150" y1="-5" x2="150" y2="5" />
        <text x="75" y="-6" textAnchor="middle">about ½ mile</text>
      </g>
    </svg>
  );
}

/** The temple courts, north at the top (the sanctuary faces east). Drawn for this app; simplified. */
function TemplePlan({ sel, onPick }: { sel: string | null; onPick: (id: string) => void }) {
  const h = (id: string, label: string, el: ReactNode) => (
    <Hot id={id} sel={sel} onPick={onPick} label={label}>
      {el}
    </Hot>
  );
  return (
    <svg viewBox="0 0 560 640" className="jplan" role="img" aria-label="Plan of the temple courts">
      {h('court-gentiles', 'Court of the Gentiles', <><path className="j-court outer" d="M120 60 L 440 50 L 452 600 L 104 612 Z" /><text className="j-label" x="150" y="140">Court of the Gentiles</text></>)}
      {h('temple-antonia', 'Fortress Antonia', <><rect className="j-building" x="66" y="28" width="120" height="62" /><text className="j-small" x="84" y="64">Antonia</text></>)}
      {h('royal-stoa', 'Royal Stoa', <><rect className="j-stoa" x="108" y="560" width="344" height="40" /><text className="j-small" x="226" y="585">Royal Stoa</text></>)}
      {h('solomons-porch', 'Solomon’s Porch', <><rect className="j-stoa" x="414" y="56" width="32" height="500" /><text className="j-small" x="434" y="300" transform="rotate(90 434 300)" textAnchor="middle">Solomon’s Porch</text></>)}
      {h('soreg', 'The dividing wall (soreg)', <><rect className="j-soreg" x="150" y="196" width="244" height="164" /><text className="j-small" x="160" y="376">soreg: no Gentiles past here</text></>)}
      {h('court-women', 'Court of the Women', <><rect className="j-court" x="306" y="222" width="76" height="112" /><text className="j-small" x="312" y="244">Court of</text><text className="j-small" x="312" y="257">the Women</text>{Array.from({ length: 13 }, (_, i) => <rect key={i} className="j-chest" x={312 + (i % 7) * 9} y={i < 7 ? 300 : 314} width="5" height="8" />)}</>)}
      {h('beautiful-gate', 'The Beautiful Gate', <><rect className="j-gate" x="378" y="266" width="10" height="24" /><text className="j-small" x="392" y="214">Beautiful</text><text className="j-small" x="392" y="226">Gate</text></>)}
      {h('court-israel', 'Court of Israel', <><rect className="j-court" x="286" y="230" width="18" height="96" /><text className="j-small" x="250" y="216">Court of Israel</text></>)}
      {h('court-priests', 'Court of the Priests and the altar', <><rect className="j-court priests" x="166" y="230" width="118" height="96" /><rect className="j-altar" x="246" y="262" width="26" height="26" /><text className="j-small" x="236" y="306">altar</text></>)}
      {h('sanctuary', 'The sanctuary', <><rect className="j-sanctuary" x="176" y="250" width="58" height="56" /><line className="j-veil" x1="194" y1="250" x2="194" y2="306" /><text className="j-small" x="160" y="342">sanctuary</text></>)}
      {h('pinnacle', 'Pinnacle of the temple', <><circle className="j-pinnacle" cx="450" cy="600" r="9" /><text className="j-small" x="458" y="628" textAnchor="end">pinnacle</text></>)}
      <path className="j-gate-mark" d="M200 612 l 0 10 M 300 610 l 0 10" />
      <text className="j-small muted" x="196" y="634">Huldah gates (southern steps)</text>
      <text className="j-small muted" x="468" y="300" transform="rotate(90 468 300)" textAnchor="middle">Kidron Valley ›</text>
      <g className="j-compass" transform="translate(500 50)">
        <path d="M0 18 L 8 -14 L 16 18 L 8 10 Z" />
        <text x="8" y="-20" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

function SpotInfo({ spot, onRead }: { spot: Spot | undefined; onRead: Props['onRead'] }) {
  if (!spot) return <p className="muted jinfo-empty">Tap a place on the plan to see what happened there.</p>;
  return (
    <div className="jinfo">
      <h3>{spot.name}</h3>
      <p>{spot.text}</p>
      {spot.refs.length > 0 && (
        <ul className="period-events">
          {spot.refs.map((r) => (
            <li key={r.ref}>
              <button
                onClick={() => {
                  const [b, c, v] = r.ref.split('.');
                  onRead(b, Number(c), Number(v));
                }}
              >
                <span>{r.t}</span>
                <span className="pc-ref">{formatOsis(r.ref)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Jerusalem in Jesus' Day": a city plan and a temple plan with tappable places (#jerusalem). */
export default function JerusalemPage({ focusId, onClose, onRead }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState<string | null>(null);
  const [temple, setTemple] = useState<string | null>(null);

  useEffect(() => {
    const spot = focusId ? spotById(focusId) : undefined;
    if (spot?.plan === 'city') setCity(spot.id);
    if (spot?.plan === 'temple') setTemple(spot.id);
    const el = spot ? ref.current?.querySelector(`#jplan-${spot.plan}`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else ref.current?.scrollTo({ top: 0 });
  }, [focusId]);

  return (
    <div className="periods-page jerusalem-page" ref={ref}>
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Back to reading
        </button>
        <span className="bar-title">Jerusalem in Jesus’ Day</span>
      </div>

      <section className="hero people-hero jerusalem-hero">
        <div className="hero-text">
          <h1>Jerusalem in Jesus’ Day</h1>
          <p>
            The city of Jesus’ last week, and the temple where he taught. Tap a place to see what happened there.{' '}
            <span className="hero-more">
              Plans drawn for this app and simplified, after Josephus and the Mishnah; some sites are traditional.
            </span>
          </p>
        </div>
      </section>

      <div className="periods-inner">
        <section id="jplan-city" className="jsection">
          <h2>The city</h2>
          <div className="jgrid">
            <CityPlan sel={city} onPick={setCity} />
            <SpotInfo spot={city ? spotById(city) : undefined} onRead={onRead} />
          </div>
          <p className="muted small">
            The first wall circled the Upper and Lower City; the second wall took in the northern quarter. Golgotha and
            the tomb were just outside. (A third wall was added about ten years later.)
          </p>
        </section>

        <section id="jplan-temple" className="jsection">
          <h2>The temple courts</h2>
          <div className="jgrid">
            <TemplePlan sel={temple} onPick={setTemple} />
            <SpotInfo spot={temple ? spotById(temple) : undefined} onRead={onRead} />
          </div>
          <p className="muted small">
            From the outer court inward, each court was holier than the last: Gentiles, women, Israelite men, priests,
            and the high priest alone in the Most Holy Place.
          </p>
        </section>

        <p className="muted small periods-foot">
          {SPOTS.length} places. Descriptions are written for this app.
        </p>
      </div>
    </div>
  );
}
