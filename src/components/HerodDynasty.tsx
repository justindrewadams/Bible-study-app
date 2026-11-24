/**
 * Herod's dynasty, drawn for this app: the branches that matter for the Gospels and Acts.
 * Several links run through people Scripture doesn't name (Herod's wives, Aristobulus IV); those come
 * from Josephus and are shown without a link. People in Scripture open their own cards.
 */

interface Node {
  name: string;
  /** a person card, when this person is in Scripture */
  slug?: string;
  note?: string;
  /** a wife of Herod the Great, heading a branch */
  wife?: boolean;
  children?: Node[];
}

const DYNASTY: Node = {
  name: 'Herod the Great',
  slug: 'herod_1504',
  note: 'King of Judea, 37–4 BC (Matt 2)',
  children: [
    {
      name: 'Mariamne I',
      wife: true,
      note: 'a Hasmonean princess',
      children: [
        {
          name: 'Aristobulus IV',
          note: 'executed by his father, 7 BC',
          children: [
            {
              name: 'Herod Agrippa I',
              slug: 'herod_1506',
              note: 'King, AD 41–44 (Acts 12)',
              children: [
                { name: 'Herod Agrippa II', slug: 'agrippa_111', note: 'hears Paul (Acts 25–26)' },
                { name: 'Bernice', slug: 'bernice_482', note: 'with Agrippa II (Acts 25)' },
                { name: 'Drusilla', slug: 'drusilla_1024', note: 'wife of Felix (Acts 24)' },
              ],
            },
            { name: 'Herodias', slug: 'herodias_1507', note: 'married her uncles Herod II, then Antipas' },
          ],
        },
      ],
    },
    {
      name: 'Mariamne II',
      wife: true,
      children: [
        {
          name: 'Herod II (“Philip”)',
          slug: 'philip_2345',
          note: 'Herodias’ first husband (Mark 6:17)',
          children: [{ name: 'Daughter of Herodias', slug: 'daughter_of_herodias_983', note: 'Salome in Josephus; danced for Antipas' }],
        },
      ],
    },
    {
      name: 'Malthace',
      wife: true,
      note: 'a Samaritan',
      children: [
        { name: 'Archelaus', slug: 'archelaus_291', note: 'Ethnarch of Judea, 4 BC – AD 6 (Matt 2:22)' },
        { name: 'Herod Antipas', slug: 'herod_1505', note: 'Tetrarch of Galilee and Perea (Luke 3:1)' },
      ],
    },
    {
      name: 'Cleopatra of Jerusalem',
      wife: true,
      children: [{ name: 'Philip the tetrarch', slug: 'philip_2346', note: 'Ituraea and Trachonitis (Luke 3:1)' }],
    },
  ],
};

/** Everyone in the chart who has a person card. */
export const HEROD_FAMILY = new Set<string>();
(function collect(n: Node) {
  if (n.slug) HEROD_FAMILY.add(n.slug);
  n.children?.forEach(collect);
})(DYNASTY);

function Branch({ node, current, onOpenPerson }: { node: Node; current: string; onOpenPerson: (slug: string) => void }) {
  const label = (
    <>
      <span className="hd-name">{node.wife ? `m. ${node.name}` : node.name}</span>
      {node.note && <span className="hd-note">{node.note}</span>}
    </>
  );
  return (
    <li className={node.wife ? 'hd-wife' : undefined}>
      {node.slug ? (
        <button
          className={`hd-person${node.slug === current ? ' current' : ''}`}
          onClick={() => onOpenPerson(node.slug!)}
          disabled={node.slug === current}
        >
          {label}
        </button>
      ) : (
        <span className="hd-person plain">{label}</span>
      )}
      {node.children && (
        <ul>
          {node.children.map((c) => (
            <Branch key={c.name} node={c} current={current} onOpenPerson={onOpenPerson} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function HerodDynasty({ current, onOpenPerson }: { current: string; onOpenPerson: (slug: string) => void }) {
  return (
    <section className="pc-section herod-dynasty">
      <h3>Herod’s dynasty</h3>
      <ul className="hd-tree">
        <Branch node={DYNASTY} current={current} onOpenPerson={onOpenPerson} />
      </ul>
      <p className="muted small">
        Herod had ten wives; only the branches in the Gospels and Acts are shown. Names in grey aren’t in Scripture
        (from Josephus).
      </p>
    </section>
  );
}
