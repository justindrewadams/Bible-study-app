import { BOOKS, getBook } from './books';

/**
 * The 13 periods of Bible history, following the outline Bob and Sandra Waldron
 * use in their Bible overview studies. Chapter boundaries for books that span
 * periods (and the placement of the prophets and poetry) follow common
 * conservative datings; a few placements (Job, Joel, Obadiah) are debated.
 */

export interface PassageRange {
  book: string; // OSIS
  from: number; // first chapter
  to: number; // last chapter
}

export interface Period {
  n: number;
  id: string;
  name: string;
  dates: string;
  color: string;
  summary: string;
  people: string[];
  events: { t: string; ref: string }[];
  passages: PassageRange[];
  journeys: string[];
  note?: string;
}

const all = (book: string): PassageRange => ({ book, from: 1, to: getBook(book).chapters });
const ch = (book: string, from: number, to: number): PassageRange => ({ book, from, to });

export const PERIODS: Period[] = [
  {
    n: 1,
    id: 'beginnings',
    name: 'Beginnings',
    dates: 'Creation – c. 2100 BC',
    color: '#6b8e23',
    summary:
      'God creates the heavens and the earth and makes man in His image. Sin enters through Adam and Eve, and God promises a Seed who will crush the serpent. Wickedness grows until the Flood; God saves Noah and makes a covenant with him. Afterward mankind rebels again at Babel and is scattered into nations.',
    people: ['Adam & Eve', 'Cain & Abel', 'Seth', 'Enoch', 'Noah', 'Shem, Ham & Japheth'],
    events: [
      { t: 'Creation', ref: 'Gen.1.1' },
      { t: 'The fall and the first promise', ref: 'Gen.3.15' },
      { t: 'Cain and Abel', ref: 'Gen.4.8' },
      { t: 'The Flood', ref: 'Gen.7.11' },
      { t: "God's covenant with Noah", ref: 'Gen.9.11' },
      { t: 'The tower of Babel', ref: 'Gen.11.4' },
    ],
    passages: [ch('Gen', 1, 11)],
    journeys: [],
  },
  {
    n: 2,
    id: 'patriarchs',
    name: 'Patriarchs',
    dates: 'c. 2100 – 1876 BC',
    color: '#a0522d',
    summary:
      'God calls Abraham to leave Ur and promises him a land, a great nation, and a blessing for all nations through his seed. The promises pass to Isaac and then Jacob, whose twelve sons become the tribes of Israel. Joseph is sold into Egypt, rises to power, and brings the family there to survive the famine.',
    people: ['Abraham & Sarah', 'Lot', 'Isaac & Rebekah', 'Jacob (Israel)', 'Esau', 'Joseph', 'Job'],
    events: [
      { t: "Abraham's call and promises", ref: 'Gen.12.1' },
      { t: 'The covenant of circumcision', ref: 'Gen.17.1' },
      { t: 'The offering of Isaac', ref: 'Gen.22.2' },
      { t: "Jacob's ladder", ref: 'Gen.28.12' },
      { t: 'Joseph sold into Egypt', ref: 'Gen.37.28' },
      { t: 'Jacob moves to Egypt', ref: 'Gen.46.6' },
    ],
    passages: [ch('Gen', 12, 50), all('Job')],
    journeys: ['abraham', 'jacob', 'joseph'],
    note: 'Job is usually placed in the patriarchal era.',
  },
  {
    n: 3,
    id: 'bondage',
    name: 'Bondage in Egypt',
    dates: 'c. 1876 – 1446 BC',
    color: '#b5651d',
    summary:
      "Israel multiplies in Egypt and is enslaved by a new Pharaoh. God raises up Moses, speaks from the burning bush, and sends ten plagues on Egypt. On the night of the first Passover the firstborn of Egypt die, and Israel is set free.",
    people: ['Moses', 'Aaron', 'Miriam', 'Pharaoh'],
    events: [
      { t: 'Israel enslaved', ref: 'Exod.1.8' },
      { t: 'Birth of Moses', ref: 'Exod.2.1' },
      { t: 'The burning bush', ref: 'Exod.3.2' },
      { t: 'The ten plagues begin', ref: 'Exod.7.20' },
      { t: 'The Passover', ref: 'Exod.12.21' },
    ],
    passages: [ch('Exod', 1, 12)],
    journeys: [],
  },
  {
    n: 4,
    id: 'wilderness',
    name: 'Wilderness Wandering',
    dates: '1446 – 1406 BC',
    color: '#c2873b',
    summary:
      'God parts the Red Sea and leads Israel to Mount Sinai, where He gives the Law and the plans for the tabernacle. When the people refuse to enter Canaan at Kadesh, they are sentenced to wander forty years until that generation dies. Moses restates the Law on the plains of Moab before his death.',
    people: ['Moses', 'Aaron', 'Joshua', 'Caleb', 'Korah', 'Balaam'],
    events: [
      { t: 'Crossing the Red Sea', ref: 'Exod.14.21' },
      { t: 'The Ten Commandments', ref: 'Exod.20.1' },
      { t: 'The golden calf', ref: 'Exod.32.4' },
      { t: 'The twelve spies', ref: 'Num.13.25' },
      { t: 'The bronze serpent', ref: 'Num.21.8' },
      { t: 'Death of Moses', ref: 'Deut.34.5' },
    ],
    passages: [ch('Exod', 13, 40), all('Lev'), all('Num'), all('Deut')],
    journeys: ['exodus'],
  },
  {
    n: 5,
    id: 'conquest',
    name: 'Conquest of Canaan',
    dates: '1406 – c. 1380 BC',
    color: '#9b2226',
    summary:
      'Joshua leads Israel across the Jordan on dry ground. Jericho falls, and in central, southern and northern campaigns the land is taken. The land is divided among the tribes, and Joshua calls the people to choose whom they will serve.',
    people: ['Joshua', 'Rahab', 'Caleb', 'Achan', 'Eleazar'],
    events: [
      { t: 'Crossing the Jordan', ref: 'Josh.3.17' },
      { t: 'The fall of Jericho', ref: 'Josh.6.20' },
      { t: 'The sun stands still', ref: 'Josh.10.13' },
      { t: 'The land divided', ref: 'Josh.14.1' },
      { t: '"As for me and my house"', ref: 'Josh.24.15' },
    ],
    passages: [all('Josh')],
    journeys: ['conquest'],
  },
  {
    n: 6,
    id: 'judges',
    name: 'Judges',
    dates: 'c. 1380 – 1050 BC',
    color: '#8d6e63',
    summary:
      'With no king, "everyone did what was right in his own eyes." Israel goes round a repeated cycle of sin, oppression, crying out to God, and rescue by a judge. Ruth shows faithfulness in a dark time. The period closes with Samuel, the last judge, at Shiloh and Mizpah.',
    people: ['Othniel', 'Ehud', 'Deborah & Barak', 'Gideon', 'Jephthah', 'Samson', 'Ruth & Boaz', 'Eli', 'Samuel'],
    events: [
      { t: 'The cycle begins', ref: 'Judg.2.11' },
      { t: 'Deborah and Barak', ref: 'Judg.4.4' },
      { t: "Gideon's 300", ref: 'Judg.7.7' },
      { t: 'Samson', ref: 'Judg.16.30' },
      { t: 'Ruth and Naomi', ref: 'Ruth.1.16' },
      { t: 'The LORD calls Samuel', ref: '1Sam.3.10' },
    ],
    passages: [all('Judg'), all('Ruth'), ch('1Sam', 1, 7)],
    journeys: [],
  },
  {
    n: 7,
    id: 'united-kingdom',
    name: 'United Kingdom',
    dates: '1050 – 931 BC',
    color: '#6a4c93',
    summary:
      'Israel asks for a king. Saul begins well but disobeys. David, a man after God\'s own heart, unites the nation, makes Jerusalem its capital, and receives the promise of an everlasting throne. Solomon builds the temple and is famous for his wisdom, but his heart turns to idols. Much of the poetry and wisdom literature comes from this time.',
    people: ['Saul', 'Jonathan', 'David', 'Nathan', 'Bathsheba', 'Absalom', 'Solomon'],
    events: [
      { t: 'Saul made king', ref: '1Sam.10.1' },
      { t: 'David and Goliath', ref: '1Sam.17.49' },
      { t: 'David king over all Israel', ref: '2Sam.5.3' },
      { t: "God's covenant with David", ref: '2Sam.7.12' },
      { t: 'The temple dedicated', ref: '1Kgs.8.10' },
      { t: "Solomon's heart turns away", ref: '1Kgs.11.4' },
    ],
    passages: [
      ch('1Sam', 8, 31),
      all('2Sam'),
      ch('1Kgs', 1, 11),
      all('1Chr'),
      ch('2Chr', 1, 9),
      all('Ps'),
      all('Prov'),
      all('Eccl'),
      all('Song'),
    ],
    journeys: ['david', 'ark'],
    note: '1 Chronicles 1–9 are genealogies leading up to David. Most psalms come from this era, though some are earlier or later.',
  },
  {
    n: 8,
    id: 'divided-kingdom',
    name: 'Divided Kingdom',
    dates: '931 – 722 BC',
    color: '#d1495b',
    summary:
      "Under Rehoboam the kingdom splits: ten northern tribes (Israel) follow Jeroboam, while Judah keeps David's line in Jerusalem. Every northern king continues in idolatry despite prophets like Elijah, Elisha, Amos and Hosea. In 722 BC Assyria destroys Samaria and carries Israel away.",
    people: ['Rehoboam', 'Jeroboam', 'Ahab & Jezebel', 'Elijah', 'Elisha', 'Jehu', 'Jonah', 'Amos', 'Hosea', 'Isaiah'],
    events: [
      { t: 'The kingdom divides', ref: '1Kgs.12.16' },
      { t: 'Golden calves at Bethel and Dan', ref: '1Kgs.12.28' },
      { t: 'Elijah on Mount Carmel', ref: '1Kgs.18.38' },
      { t: 'Elijah taken up', ref: '2Kgs.2.11' },
      { t: 'Jonah preaches to Nineveh', ref: 'Jonah.3.4' },
      { t: 'Samaria falls to Assyria', ref: '2Kgs.17.6' },
    ],
    passages: [
      ch('1Kgs', 12, 22),
      ch('2Kgs', 1, 17),
      ch('2Chr', 10, 28),
      all('Joel'),
      all('Jonah'),
      all('Amos'),
      all('Hos'),
      ch('Isa', 1, 35),
      all('Mic'),
    ],
    journeys: ['elijah'],
    note: "Joel's date is debated; an early date places him here. Isaiah and Micah prophesy into the next period.",
  },
  {
    n: 9,
    id: 'judah-alone',
    name: 'Judah Alone',
    dates: '722 – 586 BC',
    color: '#b8860b',
    summary:
      "Judah survives for more than a century after Israel's fall. Good kings Hezekiah and Josiah bring reform, and God delivers Jerusalem from Sennacherib. But Manasseh's wickedness and the people's unfaithfulness bring judgment. Jeremiah warns for forty years, and in 586 BC Babylon burns Jerusalem and the temple.",
    people: ['Hezekiah', 'Isaiah', 'Manasseh', 'Josiah', 'Jeremiah', 'Habakkuk', 'Zedekiah', 'Nebuchadnezzar'],
    events: [
      { t: "Hezekiah's prayer; Assyria turned back", ref: '2Kgs.19.35' },
      { t: 'The Book of the Law found', ref: '2Kgs.22.8' },
      { t: 'Jeremiah called', ref: 'Jer.1.5' },
      { t: 'The new covenant promised', ref: 'Jer.31.31' },
      { t: 'Jerusalem destroyed', ref: '2Kgs.25.9' },
    ],
    passages: [
      ch('2Kgs', 18, 25),
      ch('2Chr', 29, 36),
      ch('Isa', 36, 66),
      all('Nah'),
      all('Zeph'),
      all('Hab'),
      all('Jer'),
      all('Lam'),
      all('Obad'),
    ],
    journeys: ['exile'],
    note: 'Isaiah 40–66 looks ahead to the exile and return. Obadiah is often dated just after Edom gloated over Jerusalem\'s fall.',
  },
  {
    n: 10,
    id: 'captivity',
    name: 'Captivity',
    dates: '605 / 586 – 536 BC',
    color: '#3d405b',
    summary:
      'In Babylon the exiles learn faithfulness far from home. Daniel and his friends stay true in the king\'s court, through the fiery furnace and the lions\' den. Ezekiel ministers among the captives by the Chebar canal, promising a new heart and restoration. Babylon falls to the Medes and Persians in 539 BC.',
    people: ['Daniel', 'Shadrach, Meshach & Abednego', 'Ezekiel', 'Nebuchadnezzar', 'Belshazzar', 'Darius the Mede', 'Cyrus'],
    events: [
      { t: 'Daniel taken to Babylon', ref: 'Dan.1.6' },
      { t: "Ezekiel's vision of God's glory", ref: 'Ezek.1.28' },
      { t: 'The fiery furnace', ref: 'Dan.3.25' },
      { t: 'The valley of dry bones', ref: 'Ezek.37.4' },
      { t: 'The writing on the wall', ref: 'Dan.5.25' },
      { t: "The lions' den", ref: 'Dan.6.22' },
    ],
    passages: [all('Ezek'), all('Dan')],
    journeys: ['exile'],
  },
  {
    n: 11,
    id: 'return',
    name: 'Return',
    dates: '536 – c. 430 BC',
    color: '#2a9d8f',
    summary:
      'Cyrus lets the Jews go home. Zerubbabel leads the first return and rebuilds the temple, urged on by Haggai and Zechariah. In Persia, God protects His people through Queen Esther. Ezra teaches the Law, Nehemiah rebuilds Jerusalem\'s walls, and Malachi closes the Old Testament looking for the messenger who will prepare the Lord\'s way. About 400 years of prophetic silence follow.',
    people: ['Cyrus', 'Zerubbabel', 'Haggai', 'Zechariah', 'Esther & Mordecai', 'Ezra', 'Nehemiah', 'Malachi'],
    events: [
      { t: "Cyrus' decree", ref: 'Ezra.1.2' },
      { t: 'The temple foundation laid', ref: 'Ezra.3.11' },
      { t: '"For such a time as this"', ref: 'Esth.4.14' },
      { t: 'Ezra reads the Law', ref: 'Neh.8.8' },
      { t: 'The wall completed', ref: 'Neh.6.15' },
      { t: 'The coming messenger', ref: 'Mal.3.1' },
    ],
    passages: [all('Ezra'), all('Neh'), all('Esth'), all('Hag'), all('Zech'), all('Mal')],
    journeys: ['exile'],
  },
  {
    n: 12,
    id: 'life-of-christ',
    name: 'Life of Christ',
    dates: 'c. 5 BC – AD 30',
    color: '#1d4e89',
    summary:
      'The promised Seed comes: Jesus is born in Bethlehem, baptized by John, and spends about three years teaching, healing and calling disciples. He is rejected by the leaders, crucified at Jerusalem, and raised on the third day. After forty days He commissions the apostles and ascends to the Father.',
    people: ['Jesus', 'Mary & Joseph', 'John the Baptist', 'Peter', 'James & John', 'the Twelve', 'Pilate'],
    events: [
      { t: 'The birth of Jesus', ref: 'Luke.2.7' },
      { t: 'Baptism of Jesus', ref: 'Matt.3.16' },
      { t: 'The Sermon on the Mount', ref: 'Matt.5.1' },
      { t: "Peter's confession", ref: 'Matt.16.16' },
      { t: 'The crucifixion', ref: 'John.19.30' },
      { t: 'The resurrection', ref: 'Luke.24.6' },
      { t: 'The Great Commission', ref: 'Matt.28.19' },
    ],
    passages: [all('Matt'), all('Mark'), all('Luke'), all('John')],
    journeys: ['jesus'],
  },
  {
    n: 13,
    id: 'early-church',
    name: 'Early Church',
    dates: 'AD 30 – c. 96',
    color: '#e76f51',
    summary:
      'On Pentecost the Holy Spirit comes, Peter preaches, and about 3,000 are baptized. The church spreads from Jerusalem to Judea, Samaria and the Gentiles. Saul the persecutor becomes Paul the apostle and carries the gospel across the Roman world. The letters teach and correct the churches, and Revelation assures them that Christ wins.',
    people: ['Peter', 'Stephen', 'Philip', 'Paul', 'Barnabas', 'Timothy', 'Luke', 'James', 'John'],
    events: [
      { t: 'Pentecost', ref: 'Acts.2.38' },
      { t: 'Stephen martyred', ref: 'Acts.7.59' },
      { t: "Saul's conversion", ref: 'Acts.9.3' },
      { t: 'The gospel to the Gentiles', ref: 'Acts.10.44' },
      { t: 'The Jerusalem Council', ref: 'Acts.15.6' },
      { t: 'Paul reaches Rome', ref: 'Acts.28.16' },
      { t: 'The new heaven and new earth', ref: 'Rev.21.1' },
    ],
    passages: BOOKS.slice(BOOKS.findIndex((b) => b.osis === 'Acts')).map((b) => all(b.osis)),
    journeys: ['saul', 'paul1', 'paul2', 'paul3', 'rome'],
  },
];

/** The period a chapter belongs to. */
export function periodFor(book: string, chapter: number): Period | undefined {
  return PERIODS.find((p) => p.passages.some((r) => r.book === book && chapter >= r.from && chapter <= r.to));
}

export function formatRange(r: PassageRange): string {
  const b = getBook(r.book);
  if (r.from === 1 && r.to === b.chapters) return b.name;
  return r.from === r.to ? `${b.name} ${r.from}` : `${b.name} ${r.from}–${r.to}`;
}
