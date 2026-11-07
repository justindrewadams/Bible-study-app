/**
 * Nations and peoples of the Bible. Summaries are original to this app.
 *
 * - `family`: which son of Noah the nation descends from (Genesis 10), or 'Unknown' when Scripture doesn't say
 * - `line`: the family line as person slugs (from public/data/people.json), oldest first; the last is the founder
 * - `related`: other people worth opening (slugs), with a short note
 * - `lat`/`lon`: where to pin the nation's homeland on the map
 * - `refs`: key verses (OSIS), each with a short label
 */

export type Family = 'Shem' | 'Ham' | 'Japheth' | 'Unknown';

export interface Nation {
  id: string;
  name: string;
  aka?: string[];
  family: Family;
  /** descended from Abraham or his close family (Lot) */
  abraham?: boolean;
  region: string;
  lat: number;
  lon: number;
  origin: string;
  line?: string[];
  related?: { slug: string; note: string }[];
  history: string[];
  refs: { t: string; ref: string }[];
}

export const FAMILY_INFO: Record<Family, { label: string; color: string; blurb: string }> = {
  Shem: { label: 'Line of Shem', color: '#2f6fd6', blurb: 'Semitic peoples, including Abraham’s family' },
  Ham: { label: 'Line of Ham', color: '#f05a28', blurb: 'Canaan, Egypt, Cush and their neighbours' },
  Japheth: { label: 'Line of Japheth', color: '#3f8f2f', blurb: 'Peoples to the north and west' },
  Unknown: { label: 'Origin not given', color: '#6a4c93', blurb: 'Scripture doesn’t name their ancestor' },
};

export const NATIONS: Nation[] = [
  // ---------------- Shem: Abraham's family ----------------
  {
    id: 'israel',
    name: 'Israel',
    aka: ['Israelites', 'Hebrews', 'Children of Israel'],
    family: 'Shem',
    abraham: true,
    region:
      'The land of Canaan, between the Jordan River and the Mediterranean. After the kingdom divided, “Israel” meant the ten northern tribes, with their capital at Samaria.',
    lat: 32.0,
    lon: 35.2,
    origin:
      'The twelve tribes come from the twelve sons of Jacob, whom God renamed Israel. “Hebrew” is often traced to Eber, an ancestor of Abraham.',
    line: ['shem_2613', 'eber_1030', 'abraham_58', 'isaac_616', 'israel_682'],
    history: [
      'Jacob’s family of about seventy went down to Egypt, grew into a nation and was enslaved. God brought them out in the Exodus, gave the law at Sinai, and led them into Canaan under Joshua.',
      'After the judges, Saul, David and Solomon ruled a united kingdom. When it split in 931 BC, the ten northern tribes kept the name Israel. Assyria destroyed the northern kingdom and carried its people away in 722 BC.',
    ],
    refs: [
      { t: 'Jacob renamed Israel', ref: 'Gen.32.28' },
      { t: 'Seventy go down to Egypt', ref: 'Gen.46.27' },
      { t: 'A kingdom of priests', ref: 'Exod.19.6' },
      { t: 'The kingdom divides', ref: '1Kgs.12.20' },
      { t: 'Carried away to Assyria', ref: '2Kgs.17.6' },
    ],
  },
  {
    id: 'judah',
    name: 'Judah',
    aka: ['Jews', 'Kingdom of Judah'],
    family: 'Shem',
    abraham: true,
    region: 'The southern hill country of Canaan, with Jerusalem as its capital.',
    lat: 31.6,
    lon: 35.1,
    origin:
      'The tribe of Judah, Jacob’s fourth son, joined later by Benjamin. The word “Jew” comes from Judah.',
    line: ['abraham_58', 'isaac_616', 'israel_682', 'judah_1751'],
    history: [
      'Jacob foretold that the sceptre would not depart from Judah. David, of Judah’s tribe, became king, and God promised his line an everlasting throne, fulfilled in Jesus, the Son of David.',
      'When the kingdom divided, Judah stayed loyal to David’s heirs. Babylon destroyed Jerusalem and the temple in 586 BC. Under Cyrus of Persia the exiles returned to rebuild, and from then on the whole people were known as Jews.',
    ],
    refs: [
      { t: 'The sceptre shall not depart', ref: 'Gen.49.10' },
      { t: 'David anointed king over Judah', ref: '2Sam.2.4' },
      { t: 'Judah and Benjamin stay with Rehoboam', ref: '1Kgs.12.21' },
      { t: 'Judah taken into exile', ref: '2Kgs.25.21' },
      { t: 'Cyrus lets them return', ref: 'Ezra.1.3' },
    ],
  },
  {
    id: 'edom',
    name: 'Edomites',
    aka: ['Edom', 'Idumeans'],
    family: 'Shem',
    abraham: true,
    region:
      'Mount Seir, the rugged highlands south and southeast of the Dead Sea (southern Jordan). In New Testament times they had moved into southern Judea, then called Idumea.',
    lat: 30.6,
    lon: 35.5,
    origin: 'Esau, Jacob’s twin brother, also called Edom (“red”) after the red stew he traded his birthright for.',
    line: ['abraham_58', 'isaac_616', 'esau_1216'],
    history: [
      'Though brothers to Israel, Edom refused Israel passage on the way to Canaan. David conquered them, but they broke free under Jehoram.',
      'When Babylon sacked Jerusalem, Edom cheered and joined in, and the prophet Obadiah condemned them for it. Herod the Great, king when Jesus was born, was an Idumean.',
    ],
    refs: [
      { t: 'Esau called Edom', ref: 'Gen.25.30' },
      { t: 'Esau settles in Seir', ref: 'Gen.36.8' },
      { t: 'Edom refuses passage', ref: 'Num.20.21' },
      { t: 'David garrisons Edom', ref: '2Sam.8.14' },
      { t: 'Obadiah’s rebuke', ref: 'Obad.1.10' },
    ],
  },
  {
    id: 'amalek',
    name: 'Amalekites',
    aka: ['Amalek'],
    family: 'Shem',
    abraham: true,
    region: 'Nomads of the Negev and the Sinai desert, south of Judah.',
    lat: 30.5,
    lon: 34.5,
    origin: 'Amalek, a grandson of Esau through his son Eliphaz.',
    line: ['isaac_616', 'esau_1216', 'eliphaz_1144', 'amalek_197'],
    history: [
      'Amalek was the first nation to attack Israel after the Exodus, at Rephidim, where Israel won while Moses’ hands were held up.',
      'God told Saul to destroy them; Saul spared King Agag and lost his kingdom for it. David later struck them after they raided Ziklag. Haman “the Agagite” in Esther may descend from Agag.',
    ],
    refs: [
      { t: 'Amalek, son of Eliphaz', ref: 'Gen.36.12' },
      { t: 'Battle at Rephidim', ref: 'Exod.17.8' },
      { t: 'Saul’s commission', ref: '1Sam.15.3' },
      { t: 'David recovers Ziklag', ref: '1Sam.30.17' },
    ],
  },
  {
    id: 'moab',
    name: 'Moabites',
    aka: ['Moab'],
    family: 'Shem',
    abraham: true,
    region: 'The high plateau east of the Dead Sea, between the Arnon and Zered valleys (central Jordan).',
    lat: 31.4,
    lon: 35.8,
    origin: 'Moab, son of Lot (Abraham’s nephew) by his older daughter after the destruction of Sodom.',
    line: ['abraham_58', 'lot_1830', 'moab_2103'],
    related: [{ slug: 'ruth_2450', note: 'Ruth the Moabitess, great-grandmother of David' }],
    history: [
      'King Balak of Moab hired Balaam to curse Israel, but he could only bless them. In the judges’ time, Eglon of Moab ruled Israel until Ehud killed him.',
      'Ruth, a Moabite woman, chose Israel’s God and became an ancestor of David and of Jesus. David later conquered Moab, and King Mesha rebelled after Ahab died.',
    ],
    refs: [
      { t: 'Moab is born', ref: 'Gen.19.37' },
      { t: 'Balak fears Israel', ref: 'Num.22.4' },
      { t: 'Eglon oppresses Israel', ref: 'Judg.3.12' },
      { t: 'Ruth, a Moabite woman', ref: 'Ruth.1.4' },
      { t: 'Mesha rebels', ref: '2Kgs.3.5' },
    ],
  },
  {
    id: 'ammon',
    name: 'Ammonites',
    aka: ['Ammon', 'Children of Ammon'],
    family: 'Shem',
    abraham: true,
    region:
      'East of the Jordan, northeast of Moab, around their capital Rabbah, today’s Amman in Jordan, which still carries their name.',
    lat: 31.95,
    lon: 35.93,
    origin: 'Ben-ammi, son of Lot by his younger daughter.',
    line: ['abraham_58', 'lot_1830', 'ben-ammi_451'],
    history: [
      'Jephthah fought them in the judges’ time, and Saul’s first victory was rescuing Jabesh-gilead from Nahash the Ammonite.',
      'When they humiliated David’s envoys, war followed; Uriah died at the siege of Rabbah. Their god Molech drew Solomon and Israel into idolatry, and Tobiah the Ammonite opposed Nehemiah’s rebuilding.',
    ],
    refs: [
      { t: 'Ben-ammi is born', ref: 'Gen.19.38' },
      { t: 'War with Jephthah', ref: 'Judg.11.4' },
      { t: 'Nahash at Jabesh-gilead', ref: '1Sam.11.1' },
      { t: 'David takes Rabbah', ref: '2Sam.12.29' },
      { t: 'Opposing Nehemiah', ref: 'Neh.4.7' },
    ],
  },
  {
    id: 'ishmaelites',
    name: 'Ishmaelites',
    aka: ['Arabs', 'Kedar'],
    family: 'Shem',
    abraham: true,
    region: 'The deserts of northern Arabia, “from Havilah to Shur, east of Egypt.”',
    lat: 29.5,
    lon: 38.0,
    origin: 'Ishmael, Abraham’s son by Hagar, Sarah’s Egyptian servant. God promised to make him a great nation.',
    line: ['abraham_58', 'ishmael_630'],
    related: [
      { slug: 'hagar_1348', note: 'Ishmael’s mother' },
      { slug: 'kedar_1769', note: 'Son of Ishmael; Kedar became a byword for the desert tribes' },
    ],
    history: [
      'Ishmael fathered twelve princes, as God had promised. Their tribes became the desert peoples of Arabia, and Kedar and Nebaioth are named often by the prophets.',
      'It was a caravan of Ishmaelite traders that bought Joseph from his brothers and carried him to Egypt.',
    ],
    refs: [
      { t: 'Ishmael’s birth foretold', ref: 'Gen.16.11' },
      { t: '“I will make him a great nation”', ref: 'Gen.21.18' },
      { t: 'Twelve princes', ref: 'Gen.25.16' },
      { t: 'Joseph sold to Ishmaelites', ref: 'Gen.37.28' },
    ],
  },
  {
    id: 'midian',
    name: 'Midianites',
    aka: ['Midian'],
    family: 'Shem',
    abraham: true,
    region: 'Northwest Arabia, east of the Gulf of Aqaba; as nomads they ranged into Sinai and east of the Jordan.',
    lat: 28.5,
    lon: 35.3,
    origin: 'Midian, a son of Abraham by Keturah, his other wife.',
    line: ['abraham_58', 'midian_2075'],
    related: [
      { slug: 'keturah_1782', note: 'Midian’s mother' },
      { slug: 'jethro_2431', note: 'Priest of Midian and Moses’ father-in-law' },
    ],
    history: [
      'Moses fled to Midian, married Zipporah, daughter of Jethro the priest of Midian, and kept his flocks for forty years.',
      'Later Midian joined Moab against Israel and led them into sin at Peor. In the judges’ time they swarmed the land for seven years, until Gideon routed them with three hundred men.',
    ],
    refs: [
      { t: 'Midian, son of Keturah', ref: 'Gen.25.2' },
      { t: 'Moses flees to Midian', ref: 'Exod.2.15' },
      { t: 'War with Midian', ref: 'Num.31.7' },
      { t: 'Midian oppresses Israel', ref: 'Judg.6.1' },
      { t: 'Gideon’s victory', ref: 'Judg.7.22' },
    ],
  },

  // ---------------- Shem: other peoples ----------------
  {
    id: 'aram',
    name: 'Arameans',
    aka: ['Aram', 'Syrians'],
    family: 'Shem',
    region:
      'Syria, with its capital at Damascus. “Aram-naharaim” or Paddan-aram, in upper Mesopotamia around Haran, was where Abraham’s relatives lived.',
    lat: 33.51,
    lon: 36.29,
    origin: 'Aram, a son of Shem. Abraham’s relatives in Haran (Laban and Rebekah’s family) are called Arameans.',
    line: ['noah_2210', 'shem_2613', 'aram_285'],
    history: [
      'Israel remembered its roots: “A wandering Aramean was my father.” Isaac and Jacob both took wives from Aramean relatives.',
      'Under David, Damascus paid tribute; later its kings (Ben-hadad, Hazael, Rezin) warred with Israel. Naaman, the Aramean commander, was healed in the Jordan. Assyria took Damascus in 732 BC. Aramaic, their language, became the common tongue of the region.',
    ],
    refs: [
      { t: 'Aram, son of Shem', ref: 'Gen.10.22' },
      { t: 'Laban the Aramean', ref: 'Gen.25.20' },
      { t: '“A wandering Aramean”', ref: 'Deut.26.5' },
      { t: 'Naaman the Syrian', ref: '2Kgs.5.1' },
      { t: 'Damascus falls', ref: '2Kgs.16.9' },
    ],
  },
  {
    id: 'assyria',
    name: 'Assyria',
    aka: ['Assyrians', 'Asshur'],
    family: 'Shem',
    region:
      'Northern Mesopotamia along the upper Tigris River (northern Iraq), with its great capital at Nineveh, near modern Mosul.',
    lat: 36.36,
    lon: 43.15,
    origin: 'Asshur, a son of Shem; Nineveh is also linked with Nimrod, who “went into Assyria.”',
    line: ['noah_2210', 'shem_2613', 'asshur_349'],
    history: [
      'God sent Jonah to warn Nineveh, and the city repented. A century later Assyria was a feared empire: it conquered Samaria in 722 BC and scattered the northern tribes.',
      'Sennacherib besieged Jerusalem under Hezekiah, but the angel of the Lord struck his army. Nineveh fell in 612 BC, as Nahum had foretold.',
    ],
    refs: [
      { t: 'Asshur, son of Shem', ref: 'Gen.10.22' },
      { t: 'Nineveh repents', ref: 'Jonah.3.5' },
      { t: 'Israel carried to Assyria', ref: '2Kgs.17.6' },
      { t: 'Sennacherib’s army struck', ref: '2Kgs.19.35' },
      { t: '“Nineveh is laid waste”', ref: 'Nah.3.7' },
    ],
  },
  {
    id: 'elam',
    name: 'Elam',
    aka: ['Elamites'],
    family: 'Shem',
    region:
      'East of Babylon in southwestern Iran, with its capital at Susa (Shushan), later a royal city of Persia.',
    lat: 32.19,
    lon: 48.25,
    origin: 'Elam, Shem’s firstborn son.',
    line: ['noah_2210', 'shem_2613', 'elam_1049'],
    history: [
      'Chedorlaomer, king of Elam, led the raid that captured Lot, and Abraham pursued and rescued him.',
      'Elam was later absorbed into Persia. Its city Susa is the setting of Esther and of Nehemiah’s call, and Daniel saw a vision there. Elamites heard the gospel at Pentecost.',
    ],
    refs: [
      { t: 'Elam, son of Shem', ref: 'Gen.10.22' },
      { t: 'Chedorlaomer of Elam', ref: 'Gen.14.1' },
      { t: 'Daniel at Susa in Elam', ref: 'Dan.8.2' },
      { t: 'Elamites at Pentecost', ref: 'Acts.2.9' },
    ],
  },
  {
    id: 'sheba',
    name: 'Sheba',
    aka: ['Sabeans'],
    family: 'Unknown',
    region: 'Southwestern Arabia (modern Yemen), rich from the incense and spice trade.',
    lat: 15.4,
    lon: 45.3,
    origin:
      'Genesis names more than one Sheba: a grandson of Cush (Ham’s line) and a son of Joktan (Shem’s line). Which one founded the kingdom isn’t certain.',
    related: [
      { slug: 'sheba_2567', note: 'Sheba, son of Raamah (line of Ham)' },
      { slug: 'sheba_2568', note: 'Sheba, son of Joktan (line of Shem)' },
    ],
    history: [
      'The queen of Sheba travelled to test Solomon’s wisdom and left amazed. Jesus called her “the queen of the South,” who would judge his unbelieving generation.',
    ],
    refs: [
      { t: 'The queen of Sheba visits', ref: '1Kgs.10.1' },
      { t: 'Kings of Sheba bring gifts', ref: 'Ps.72.10' },
      { t: '“The queen of the South”', ref: 'Matt.12.42' },
    ],
  },

  // ---------------- Ham ----------------
  {
    id: 'egypt',
    name: 'Egypt',
    aka: ['Egyptians', 'Mizraim'],
    family: 'Ham',
    region: 'The Nile valley and delta in northeast Africa.',
    lat: 27.5,
    lon: 30.8,
    origin: 'Mizraim, a son of Ham. Mizraim is the Hebrew name for Egypt itself.',
    line: ['noah_2210', 'ham_1359', 'mizraim_2100'],
    history: [
      'Abraham went to Egypt in a famine. Joseph rose to rule there, and Jacob’s family settled in Goshen, where they later became slaves, until God freed them through Moses and the ten plagues.',
      'Egypt stayed a power on Israel’s border: Solomon married Pharaoh’s daughter, Shishak looted the temple, and Pharaoh Neco killed King Josiah. Joseph and Mary fled there with the infant Jesus.',
    ],
    refs: [
      { t: 'Mizraim, son of Ham', ref: 'Gen.10.6' },
      { t: 'Abraham goes down to Egypt', ref: 'Gen.12.10' },
      { t: 'Israel settles in Goshen', ref: 'Gen.47.6' },
      { t: 'The Exodus', ref: 'Exod.12.41' },
      { t: 'Flight to Egypt', ref: 'Matt.2.14' },
    ],
  },
  {
    id: 'cush',
    name: 'Cush',
    aka: ['Ethiopia', 'Cushites', 'Nubia'],
    family: 'Ham',
    region:
      'South of Egypt along the upper Nile (ancient Nubia, today’s Sudan). Older English Bibles call it Ethiopia.',
    lat: 17.5,
    lon: 33.0,
    origin: 'Cush, Ham’s eldest son. Nimrod, the mighty hunter, was also a son of Cush.',
    line: ['noah_2210', 'ham_1359', 'cush_962'],
    related: [{ slug: 'nimrod_2206', note: 'Son of Cush and founder of Babel' }],
    history: [
      'Moses married a Cushite woman. In Hezekiah’s day, Tirhakah of Cush marched against Assyria, and Ebed-melech the Cushite rescued Jeremiah from the cistern.',
      'In Acts, an Ethiopian official of Queen Candace heard the gospel from Philip and was baptized on the road home.',
    ],
    refs: [
      { t: 'Cush, son of Ham', ref: 'Gen.10.6' },
      { t: 'Moses’ Cushite wife', ref: 'Num.12.1' },
      { t: 'Tirhakah of Cush', ref: '2Kgs.19.9' },
      { t: 'Ebed-melech rescues Jeremiah', ref: 'Jer.38.7' },
      { t: 'The Ethiopian official', ref: 'Acts.8.27' },
    ],
  },
  {
    id: 'put',
    name: 'Put',
    aka: ['Libya', 'Phut'],
    family: 'Ham',
    region: 'North Africa west of Egypt, usually identified with Libya.',
    lat: 30.8,
    lon: 23.5,
    origin: 'Put (Phut), a son of Ham.',
    line: ['noah_2210', 'ham_1359', 'phut_2354'],
    history: [
      'Put appears mostly as a source of soldiers, serving in the armies of Egypt and Tyre. The prophets name it among the allies who could not save those who trusted in them.',
    ],
    refs: [
      { t: 'Put, son of Ham', ref: 'Gen.10.6' },
      { t: 'Soldiers of Tyre', ref: 'Ezek.27.10' },
      { t: 'Egypt’s helpers', ref: 'Nah.3.9' },
    ],
  },
  {
    id: 'babylon',
    name: 'Babylon',
    aka: ['Babylonians', 'Chaldeans', 'Shinar'],
    family: 'Ham',
    region:
      'Southern Mesopotamia between the Tigris and Euphrates (southern Iraq), with the city of Babylon on the Euphrates.',
    lat: 32.54,
    lon: 44.42,
    origin:
      'Babel was the first city of Nimrod’s kingdom, and Nimrod was a son of Cush. The later Chaldean rulers’ ancestry isn’t given.',
    line: ['noah_2210', 'ham_1359', 'cush_962', 'nimrod_2206'],
    history: [
      'At Babel, people built a tower to make a name for themselves, and God confused their language. Abraham’s family came from Ur of the Chaldeans.',
      'Nebuchadnezzar of Babylon took Daniel captive, then destroyed Jerusalem and the temple in 586 BC, beginning the seventy years of exile. Babylon fell to the Medes and Persians in 539 BC on the night of Belshazzar’s feast. Revelation uses Babylon as a picture of the proud world opposed to God.',
    ],
    refs: [
      { t: 'Nimrod’s kingdom begins at Babel', ref: 'Gen.10.10' },
      { t: 'The tower of Babel', ref: 'Gen.11.9' },
      { t: 'Daniel taken to Babylon', ref: 'Dan.1.1' },
      { t: 'The temple burned', ref: '2Kgs.25.9' },
      { t: 'Babylon falls', ref: 'Dan.5.30' },
    ],
  },
  {
    id: 'canaanites',
    name: 'Canaanites',
    aka: ['Canaan'],
    family: 'Ham',
    region: 'The land west of the Jordan, from Sidon in the north to Gaza in the south: the land promised to Abraham.',
    lat: 32.3,
    lon: 35.0,
    origin:
      'Canaan, a son of Ham, whom Noah cursed. His descendants included the Sidonians, Hittites, Jebusites, Amorites, Girgashites and Hivites.',
    line: ['noah_2210', 'ham_1359', 'canaan_914'],
    history: [
      'God promised Canaan’s land to Abraham’s descendants but waited four hundred years, until the people’s sin had “reached its full measure.” Israel was told to drive them out and not adopt their gods.',
      'Israel never fully did, and the worship of Baal and Asherah that remained drew them into idolatry again and again.',
    ],
    refs: [
      { t: 'Noah curses Canaan', ref: 'Gen.9.25' },
      { t: 'Canaan’s descendants', ref: 'Gen.10.15' },
      { t: '“The Canaanites were then in the land”', ref: 'Gen.12.6' },
      { t: 'Seven nations to drive out', ref: 'Deut.7.1' },
      { t: 'The Canaanites remain', ref: 'Judg.1.27' },
    ],
  },
  {
    id: 'phoenicia',
    name: 'Phoenicians',
    aka: ['Sidonians', 'Tyre and Sidon'],
    family: 'Ham',
    region: 'The Mediterranean coast north of Israel (today’s Lebanon), around the port cities of Tyre and Sidon.',
    lat: 33.5,
    lon: 35.3,
    origin: 'Sidon, Canaan’s firstborn son, gave his name to the city of Sidon.',
    line: ['noah_2210', 'ham_1359', 'canaan_914', 'zidon_2738'],
    history: [
      'A nation of sailors and traders. Hiram of Tyre sent cedar and craftsmen for David’s palace and Solomon’s temple. Jezebel, a princess of Sidon, brought Baal worship into Israel when she married Ahab.',
      'Ezekiel foretold Tyre’s fall. Jesus visited the region of Tyre and Sidon and healed a Syrophoenician woman’s daughter, and Paul stayed with believers in Tyre.',
    ],
    refs: [
      { t: 'Sidon, Canaan’s firstborn', ref: 'Gen.10.15' },
      { t: 'Hiram of Tyre helps Solomon', ref: '1Kgs.5.1' },
      { t: 'Jezebel of Sidon', ref: '1Kgs.16.31' },
      { t: 'Lament for Tyre', ref: 'Ezek.27.3' },
      { t: 'The Syrophoenician woman', ref: 'Mark.7.26' },
    ],
  },
  {
    id: 'hittites',
    name: 'Hittites',
    aka: ['Children of Heth'],
    family: 'Ham',
    region:
      'In Abraham’s day, around Hebron in Canaan. A great Hittite empire also ruled central Anatolia (Turkey), and later Hittite kingdoms lay north of Israel in Syria.',
    lat: 31.53,
    lon: 35.1,
    origin: 'Heth, a son of Canaan.',
    line: ['noah_2210', 'ham_1359', 'canaan_914', 'heth_1510'],
    history: [
      'Abraham bought the cave of Machpelah from Ephron the Hittite to bury Sarah. Esau grieved his parents by marrying Hittite wives.',
      'Uriah the Hittite was one of David’s mighty men, and Solomon traded chariots and horses with the kings of the Hittites.',
    ],
    refs: [
      { t: 'Heth, son of Canaan', ref: 'Gen.10.15' },
      { t: 'Abraham buys Machpelah', ref: 'Gen.23.10' },
      { t: 'Esau’s Hittite wives', ref: 'Gen.26.34' },
      { t: 'Uriah the Hittite', ref: '2Sam.11.3' },
      { t: 'Kings of the Hittites', ref: '1Kgs.10.29' },
    ],
  },
  {
    id: 'amorites',
    name: 'Amorites',
    aka: ['Amorite'],
    family: 'Ham',
    region:
      'The hill country of Canaan, and east of the Jordan in the kingdoms of Sihon (at Heshbon) and Og (in Bashan).',
    lat: 31.8,
    lon: 35.8,
    origin: 'A people descended from Canaan; Genesis lists “the Amorite” among his offspring.',
    line: ['noah_2210', 'ham_1359', 'canaan_914', 'amorite_237'],
    history: [
      'God told Abraham his descendants would wait, because “the iniquity of the Amorites is not yet complete.” On the way to Canaan, Israel defeated the Amorite kings Sihon and Og.',
      'Five Amorite kings attacked Gibeon, and the sun stood still while Joshua defeated them. Joshua later challenged Israel to choose between the Lord and “the gods of the Amorites.”',
    ],
    refs: [
      { t: '“The Amorite” in Canaan’s line', ref: 'Gen.10.16' },
      { t: 'Their iniquity not yet complete', ref: 'Gen.15.16' },
      { t: 'Sihon defeated', ref: 'Num.21.24' },
      { t: 'Five Amorite kings', ref: 'Josh.10.5' },
      { t: '“Choose this day”', ref: 'Josh.24.15' },
    ],
  },
  {
    id: 'jebusites',
    name: 'Jebusites',
    aka: ['Jebus'],
    family: 'Ham',
    region: 'Jebus, the hill fortress that became Jerusalem.',
    lat: 31.777,
    lon: 35.235,
    origin: 'A people descended from Canaan; Genesis lists “the Jebusite” among his offspring.',
    line: ['noah_2210', 'ham_1359', 'canaan_914', 'jebusite_748'],
    history: [
      'The Jebusites held Jerusalem through the days of Joshua and the judges. David captured their stronghold, Zion, and made it the City of David.',
      'Araunah the Jebusite sold David his threshing floor, where Solomon later built the temple.',
    ],
    refs: [
      { t: '“The Jebusite”', ref: 'Gen.10.16' },
      { t: 'Judah couldn’t drive them out', ref: 'Josh.15.63' },
      { t: 'David takes Zion', ref: '2Sam.5.6' },
      { t: 'Araunah’s threshing floor', ref: '2Sam.24.18' },
    ],
  },
  {
    id: 'hivites',
    name: 'Hivites',
    aka: ['Gibeonites'],
    family: 'Ham',
    region: 'Scattered through central and northern Canaan: Shechem, Gibeon, and the foot of Mount Hermon.',
    lat: 31.85,
    lon: 35.18,
    origin: 'A people descended from Canaan; Genesis lists “the Hivite” among his offspring.',
    line: ['noah_2210', 'ham_1359', 'canaan_914', 'hivite_1534'],
    history: [
      'Shechem, son of Hamor the Hivite, took Dinah, and her brothers took revenge on his city.',
      'The Gibeonites, who were Hivites, tricked Joshua into a peace treaty by pretending to come from far away. Israel kept its oath, and they served at the tabernacle.',
    ],
    refs: [
      { t: '“The Hivite”', ref: 'Gen.10.17' },
      { t: 'Shechem the Hivite', ref: 'Gen.34.2' },
      { t: 'The Gibeonites’ trick', ref: 'Josh.9.7' },
      { t: 'Hivites under Hermon', ref: 'Josh.11.3' },
    ],
  },
  {
    id: 'philistines',
    name: 'Philistines',
    aka: ['Philistia'],
    family: 'Ham',
    region:
      'The southern coastal plain of Canaan, with five chief cities: Gaza, Ashkelon, Ashdod, Gath and Ekron. They came there from Caphtor (Crete).',
    lat: 31.6,
    lon: 34.6,
    origin: 'Descendants of Casluhim, a son of Mizraim (Egypt). Amos says God brought them from Caphtor.',
    line: ['noah_2210', 'ham_1359', 'mizraim_2100', 'casluhim_923'],
    history: [
      'Abraham and Isaac made treaties with Abimelech, king of Gerar. In the judges’ time the Philistines ruled Israel; Samson fought them, and they captured the ark of the covenant.',
      'David killed their champion Goliath of Gath, and they killed Saul on Mount Gilboa. David finally subdued them. The name “Palestine” comes from them.',
    ],
    refs: [
      { t: 'From Casluhim', ref: 'Gen.10.14' },
      { t: 'Samson’s day', ref: 'Judg.13.1' },
      { t: 'The ark captured', ref: '1Sam.4.11' },
      { t: 'Goliath of Gath', ref: '1Sam.17.4' },
      { t: 'Brought from Caphtor', ref: 'Amos.9.7' },
    ],
  },

  // ---------------- Japheth ----------------
  {
    id: 'medes',
    name: 'Medes',
    aka: ['Media', 'Madai'],
    family: 'Japheth',
    region: 'Northwestern Iran, with its capital at Ecbatana (modern Hamadan).',
    lat: 34.8,
    lon: 48.5,
    origin: 'Madai, a son of Japheth.',
    line: ['noah_2210', 'japheth_726', 'madai_1880'],
    history: [
      'Assyria settled some of the exiles from Israel in “the cities of the Medes.” Isaiah foretold that the Medes would be stirred up against Babylon.',
      'Joined with Persia, they took Babylon in 539 BC. Daniel served under Darius the Mede, and the unchangeable “law of the Medes and Persians” put him in the lions’ den. Medes were in Jerusalem at Pentecost.',
    ],
    refs: [
      { t: 'Madai, son of Japheth', ref: 'Gen.10.2' },
      { t: 'Cities of the Medes', ref: '2Kgs.17.6' },
      { t: 'Stirred up against Babylon', ref: 'Isa.13.17' },
      { t: 'Given to the Medes and Persians', ref: 'Dan.5.28' },
      { t: 'Medes at Pentecost', ref: 'Acts.2.9' },
    ],
  },
  {
    id: 'greece',
    name: 'Greece',
    aka: ['Greeks', 'Javan', 'Ionia'],
    family: 'Japheth',
    region:
      'Greece, the Aegean islands and the coasts of Asia Minor. In the New Testament: the Roman provinces of Macedonia and Achaia.',
    lat: 38.5,
    lon: 23.0,
    origin: 'Javan, a son of Japheth. Javan is the Hebrew name for the Ionian Greeks.',
    line: ['noah_2210', 'japheth_726', 'javan_744'],
    history: [
      'Daniel saw Greece as a swift goat whose great horn was broken: Alexander the Great, whose empire was split among his generals. Their successors ruled Judea between the Testaments, and the New Testament was written in Greek.',
      'Paul preached across Greece, in Philippi, Thessalonica, Athens and Corinth. The gospel is “to the Jew first and also to the Greek.”',
    ],
    refs: [
      { t: 'Javan, son of Japheth', ref: 'Gen.10.2' },
      { t: 'The king of Greece', ref: 'Dan.8.21' },
      { t: 'Paul at Athens', ref: 'Acts.17.22' },
      { t: 'To the Jew and the Greek', ref: 'Rom.1.16' },
    ],
  },
  {
    id: 'magog',
    name: 'Magog, Meshech and Tubal',
    aka: ['Gog and Magog', 'Gomer'],
    family: 'Japheth',
    region:
      'Peoples of the far north: eastern Anatolia (Turkey), the Black Sea and the Caucasus, the edge of the world known to Israel.',
    lat: 40.0,
    lon: 40.0,
    origin: 'Magog, Meshech, Tubal and Gomer were all sons of Japheth.',
    line: ['noah_2210', 'japheth_726', 'magog_1882'],
    related: [
      { slug: 'meshech_2012', note: 'Son of Japheth' },
      { slug: 'tubal_2883', note: 'Son of Japheth' },
      { slug: 'gomer_1328', note: 'Son of Japheth' },
    ],
    history: [
      'Meshech and Tubal traded slaves and bronze with Tyre. Ezekiel saw “Gog, of the land of Magog, the chief prince of Meshech and Tubal” lead a great northern army against God’s people and fall.',
      'Revelation takes up the picture: Gog and Magog gathered for the last battle and defeated.',
    ],
    refs: [
      { t: 'Sons of Japheth', ref: 'Gen.10.2' },
      { t: 'Trading with Tyre', ref: 'Ezek.27.13' },
      { t: 'Gog of the land of Magog', ref: 'Ezek.38.2' },
      { t: 'Gog and Magog', ref: 'Rev.20.8' },
    ],
  },

  // ---------------- Origin not given ----------------
  {
    id: 'persia',
    name: 'Persia',
    aka: ['Persians'],
    family: 'Unknown',
    region: 'Southwestern Iran; its empire stretched from India to Egypt, with royal cities at Susa, Persepolis and Ecbatana.',
    lat: 30.0,
    lon: 52.9,
    origin: 'Genesis doesn’t name an ancestor for the Persians; they rose to power alongside the Medes.',
    history: [
      'Isaiah named Cyrus as God’s chosen deliverer long before he lived. Cyrus took Babylon in 539 BC and let the Jews go home to rebuild the temple.',
      'Darius saw the temple finished; Esther became queen to Ahasuerus (Xerxes) and saved her people; Artaxerxes sent Ezra and Nehemiah to Jerusalem. Persia fell to Alexander the Great, as Daniel foresaw.',
    ],
    refs: [
      { t: 'Cyrus named in advance', ref: 'Isa.45.1' },
      { t: 'Cyrus’s decree', ref: 'Ezra.1.2' },
      { t: 'Ahasuerus and Esther', ref: 'Esth.1.1' },
      { t: 'Nehemiah before Artaxerxes', ref: 'Neh.2.1' },
      { t: 'Media and Persia in Daniel', ref: 'Dan.8.20' },
    ],
  },
  {
    id: 'rome',
    name: 'Rome',
    aka: ['Romans'],
    family: 'Unknown',
    region: 'Italy, with its capital at Rome; by the New Testament its empire circled the whole Mediterranean.',
    lat: 41.9,
    lon: 12.5,
    origin: 'Scripture doesn’t trace the Romans to one of Noah’s sons by name.',
    history: [
      'Rome took Judea in 63 BC. Caesar Augustus’s census brought Joseph and Mary to Bethlehem, and the Roman governor Pontius Pilate sentenced Jesus to be crucified.',
      'Paul, a Roman citizen, appealed to Caesar and preached in Rome under house arrest. Rome destroyed Jerusalem and the temple in AD 70, as Jesus had warned.',
    ],
    refs: [
      { t: 'The fourth kingdom', ref: 'Dan.2.40' },
      { t: 'Caesar Augustus’s decree', ref: 'Luke.2.1' },
      { t: 'Delivered to Pilate', ref: 'Matt.27.2' },
      { t: '“I appeal to Caesar”', ref: 'Acts.25.11' },
      { t: 'Paul in Rome', ref: 'Acts.28.16' },
    ],
  },
  {
    id: 'samaritans',
    name: 'Samaritans',
    aka: ['Samaria'],
    family: 'Unknown',
    region: 'The hill country of Samaria between Judea and Galilee, with their holy mountain, Gerizim.',
    lat: 32.2,
    lon: 35.27,
    origin:
      'A mixed people. After Assyria deported the northern tribes, it settled foreigners from Babylon, Cuthah, Hamath and elsewhere in Samaria. They mixed with the Israelites left behind and blended the worship of the Lord with their own gods.',
    history: [
      'They opposed the Jews who returned to rebuild Jerusalem, and the two peoples stayed bitter rivals: “Jews have no dealings with Samaritans.”',
      'Jesus crossed that line: he spoke with the woman at the well, told the parable of the Good Samaritan, and praised a Samaritan leper’s thanks. Philip later preached Christ in Samaria, and many believed.',
    ],
    refs: [
      { t: 'Foreigners settled in Samaria', ref: '2Kgs.17.24' },
      { t: 'Opposing the rebuilding', ref: 'Ezra.4.1' },
      { t: 'The good Samaritan', ref: 'Luke.10.33' },
      { t: 'The woman at the well', ref: 'John.4.9' },
      { t: 'Philip in Samaria', ref: 'Acts.8.5' },
    ],
  },
  {
    id: 'kenites',
    name: 'Kenites',
    aka: ['Kenite'],
    family: 'Unknown',
    region: 'Nomads of the Negev near Arad, south of Judah; some lived further north among Israel.',
    lat: 31.28,
    lon: 35.12,
    origin: 'Their ancestor isn’t named. Moses’ father-in-law was a Kenite, and the Rechabites came from them.',
    related: [
      { slug: 'jethro_2431', note: 'Moses’ father-in-law, called a Kenite in Judges' },
      { slug: 'hobab_1537', note: 'Moses asked him to guide Israel in the wilderness' },
    ],
    history: [
      'The Kenites travelled with Israel and settled among Judah. Jael, wife of Heber the Kenite, killed the Canaanite general Sisera.',
      'Saul spared them when he struck Amalek, because they had shown kindness to Israel. The Rechabites, praised by Jeremiah for their faithfulness, were Kenites.',
    ],
    refs: [
      { t: 'Settling with Judah', ref: 'Judg.1.16' },
      { t: 'Jael, wife of Heber the Kenite', ref: 'Judg.4.17' },
      { t: 'Saul spares the Kenites', ref: '1Sam.15.6' },
      { t: 'The Rechabites', ref: '1Chr.2.55' },
    ],
  },
  {
    id: 'anakim',
    name: 'Anakim',
    aka: ['Sons of Anak', 'Giants'],
    family: 'Unknown',
    region: 'Hebron and the hill country of Judah; survivors remained in Gaza, Gath and Ashdod.',
    lat: 31.53,
    lon: 35.1,
    origin: 'Descendants of Anak, a giant of Canaan; his own ancestry isn’t given beyond his father Arba.',
    related: [{ slug: 'anak_252', note: 'Ancestor of the Anakim' }],
    history: [
      'The twelve spies saw the sons of Anak and felt like grasshoppers beside them, and fear kept Israel out of the land for forty years.',
      'Caleb, at eighty-five, asked for their hill country and drove out Anak’s three sons from Hebron. A few survived in Philistine Gath, the home of Goliath.',
    ],
    refs: [
      { t: '“We seemed like grasshoppers”', ref: 'Num.13.33' },
      { t: 'Survivors in Gath', ref: 'Josh.11.22' },
      { t: 'Caleb drives them out', ref: 'Josh.15.14' },
    ],
  },
];

/** Nations whose family line ends with (or includes as founder) this person. */
export function nationsFoundedBy(slug: string) {
  return NATIONS.filter((n) => n.line?.[n.line.length - 1] === slug);
}
