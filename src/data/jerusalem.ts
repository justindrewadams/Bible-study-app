/**
 * Places on the "Jerusalem in Jesus' Day" page: the city plan and the temple plan (both drawn for this app,
 * simplified, after Josephus and the Mishnah). Each spot has a short original description and its verses.
 */

export interface Spot {
  id: string;
  name: string;
  plan: 'city' | 'temple';
  text: string;
  refs: { t: string; ref: string }[];
  /** other names people search for */
  aka?: string[];
}

export const SPOTS: Spot[] = [
  // ---------------- the city
  {
    id: 'temple-mount', name: 'The temple', plan: 'city', aka: ['Temple Mount'],
    text: 'Herod’s rebuilt temple on its vast platform, about 35 acres. Jesus taught here every day of his last week. See the temple plan below.',
    refs: [{ t: 'Looks around at everything', ref: 'Mark.11.11' }, { t: 'Teaching daily in the temple', ref: 'Luke.21.37' }, { t: 'Not one stone left', ref: 'Matt.24.2' }],
  },
  {
    id: 'antonia', name: 'Fortress Antonia', plan: 'city', aka: ['Antonia', 'the barracks'],
    text: 'Herod’s fortress at the temple’s northwest corner, home to the Roman garrison that watched the courts. Paul was carried up its steps.',
    refs: [{ t: 'Paul taken into the barracks', ref: 'Acts.21.34' }, { t: 'Paul speaks from the steps', ref: 'Acts.21.40' }],
  },
  {
    id: 'herods-palace', name: 'Herod’s palace (the praetorium)', plan: 'city', aka: ['Praetorium', 'Gabbatha', 'Stone Pavement', 'Pilate'],
    text: 'Herod the Great’s palace on the western hill, where the Roman governor stayed when in Jerusalem. Most scholars place Jesus’ trial before Pilate here (others at the Antonia).',
    refs: [{ t: 'Led to the governor’s headquarters', ref: 'John.18.28' }, { t: 'The judgment seat at the Stone Pavement', ref: 'John.19.13' }, { t: 'The soldiers gather the battalion', ref: 'Mark.15.16' }],
  },
  {
    id: 'hasmonean-palace', name: 'Herod Antipas’ quarters', plan: 'city', aka: ['Hasmonean palace', 'Herod Antipas'],
    text: 'Probably the old Hasmonean palace overlooking the temple, where Herod Antipas stayed for the feasts.',
    refs: [{ t: 'Pilate sends Jesus to Herod', ref: 'Luke.23.7' }, { t: 'Herod and Pilate become friends', ref: 'Luke.23.12' }],
  },
  {
    id: 'high-priest', name: 'The high priest’s house', plan: 'city', aka: ['Caiaphas', 'Annas', 'house of Caiaphas'],
    text: 'Annas and Caiaphas lived in the wealthy Upper City. The traditional site is on the eastern slope of the western hill. Peter warmed himself in the courtyard below.',
    refs: [{ t: 'Taken first to Annas', ref: 'John.18.13' }, { t: 'Before Caiaphas and the council', ref: 'Mark.14.53' }, { t: 'Peter in the courtyard', ref: 'Luke.22.55' }],
  },
  {
    id: 'upper-room', name: 'The upper room', plan: 'city', aka: ['Cenacle', 'Last Supper'],
    text: 'A large furnished upper room, traditionally placed on the southwestern hill (Mount Zion). The disciples were still meeting in an upper room after the ascension.',
    refs: [{ t: 'A large upper room, furnished', ref: 'Mark.14.15' }, { t: 'The Lord’s Supper', ref: 'Luke.22.19' }, { t: 'Gathered in the upper room', ref: 'Acts.1.13' }],
  },
  {
    id: 'siloam', name: 'Pool of Siloam', plan: 'city', aka: ['Siloam'],
    text: 'At the south end of the Lower City, fed by Hezekiah’s tunnel. Its steps were uncovered in 2004.',
    refs: [{ t: 'Go, wash in the pool of Siloam', ref: 'John.9.7' }, { t: 'The tower in Siloam', ref: 'Luke.13.4' }],
  },
  {
    id: 'bethesda', name: 'Pool of Bethesda', plan: 'city', aka: ['Bethesda', 'Sheep Gate'],
    text: 'Twin pools with five porches, north of the temple near the Sheep Gate.',
    refs: [{ t: 'The man ill for 38 years', ref: 'John.5.2' }],
  },
  {
    id: 'kidron', name: 'Kidron Valley', plan: 'city', aka: ['Kidron', 'brook Kidron'],
    text: 'The valley between the temple and the Mount of Olives. Jesus crossed it on the way to Gethsemane, as David once crossed it fleeing Absalom.',
    refs: [{ t: 'Across the brook Kidron', ref: 'John.18.1' }, { t: 'David crosses the Kidron', ref: '2Sam.15.23' }],
  },
  {
    id: 'gethsemane', name: 'Gethsemane', plan: 'city', aka: ['Garden of Gethsemane'],
    text: '“Oil press”: an olive grove at the foot of the Mount of Olives, where Jesus often went with his disciples.',
    refs: [{ t: 'Sit here while I pray', ref: 'Matt.26.36' }, { t: 'As was his custom', ref: 'Luke.22.39' }, { t: 'Judas knew the place', ref: 'John.18.2' }],
  },
  {
    id: 'olives', name: 'Mount of Olives', plan: 'city', aka: ['Olivet'],
    text: 'The ridge east of the city, about 300 feet higher than the temple, on the road to Bethany and Jericho.',
    refs: [{ t: 'The descent of the Mount of Olives', ref: 'Luke.19.37' }, { t: 'Sitting opposite the temple', ref: 'Mark.13.3' }, { t: 'The ascension', ref: 'Acts.1.12' }],
  },
  {
    id: 'golgotha', name: 'Golgotha', plan: 'city', aka: ['Calvary', 'Place of a Skull'],
    text: '“Place of a Skull,” outside the city wall but near it, beside a road. The traditional site (the Church of the Holy Sepulchre) lay just outside the second wall.',
    refs: [{ t: 'He went out to the place of a skull', ref: 'John.19.17' }, { t: 'Near the city', ref: 'John.19.20' }, { t: 'Outside the gate', ref: 'Heb.13.12' }],
  },
  {
    id: 'tomb', name: 'The garden tomb', plan: 'city', aka: ['Tomb', 'Joseph of Arimathea'],
    text: 'Joseph of Arimathea’s new tomb, cut in rock in a garden near the place of crucifixion.',
    refs: [{ t: 'A new tomb in a garden', ref: 'John.19.41' }, { t: 'He is not here', ref: 'Matt.28.6' }],
  },
  {
    id: 'upper-city', name: 'The Upper City', plan: 'city',
    text: 'The western hill, higher and wealthier: priestly families, mansions and Herod’s palace.',
    refs: [],
  },
  {
    id: 'lower-city', name: 'The Lower City (City of David)', plan: 'city', aka: ['City of David'],
    text: 'The narrow ridge south of the temple, the oldest part of Jerusalem, where David took the stronghold of Zion.',
    refs: [{ t: 'The stronghold of Zion', ref: '2Sam.5.7' }],
  },
  {
    id: 'hinnom', name: 'Hinnom Valley', plan: 'city', aka: ['Gehenna', 'Valley of Hinnom'],
    text: 'The valley along the west and south of the city. Its Hebrew name, Ge-Hinnom, became “Gehenna,” the word Jesus used for hell.',
    refs: [{ t: 'Child sacrifice in the valley', ref: 'Jer.7.31' }, { t: 'Destroy both soul and body in hell', ref: 'Matt.10.28' }],
  },

  // ---------------- the temple
  {
    id: 'court-gentiles', name: 'Court of the Gentiles', plan: 'temple',
    text: 'The great outer court, open to everyone. The animal sellers and money-changers set up here, where the nations were meant to pray.',
    refs: [{ t: 'He overturned the tables', ref: 'Mark.11.15' }, { t: 'A house of prayer for all nations', ref: 'Mark.11.17' }, { t: 'The earlier cleansing', ref: 'John.2.14' }],
  },
  {
    id: 'royal-stoa', name: 'Royal Stoa', plan: 'temple', aka: ['Royal Porch'],
    text: 'A great hall of columns along the south side, probably a center of the temple’s business.',
    refs: [],
  },
  {
    id: 'solomons-porch', name: 'Solomon’s Porch', plan: 'temple', aka: ['Solomon’s Colonnade', 'Solomon’s Portico'],
    text: 'The colonnade along the east side. Jesus walked here at the Feast of Dedication; the early church gathered here.',
    refs: [{ t: 'Jesus walks in Solomon’s colonnade', ref: 'John.10.23' }, { t: 'The people run to them', ref: 'Acts.3.11' }, { t: 'All together in Solomon’s Portico', ref: 'Acts.5.12' }],
  },
  {
    id: 'soreg', name: 'The dividing wall (soreg)', plan: 'temple', aka: ['soreg', 'dividing wall', 'balustrade'],
    text: 'A low stone barrier around the inner courts, with signs warning Gentiles not to go further on pain of death. Paul was accused of bringing a Greek past it.',
    refs: [{ t: 'He brought Greeks into the temple', ref: 'Acts.21.28' }, { t: 'Broken down the dividing wall', ref: 'Eph.2.14' }],
  },
  {
    id: 'court-women', name: 'Court of the Women', plan: 'temple', aka: ['treasury', 'trumpets'],
    text: 'Open to all Israelites, women included. Thirteen trumpet-shaped chests for offerings stood here; the widow gave her two coins here.',
    refs: [{ t: 'The widow’s offering', ref: 'Mark.12.41' }, { t: 'Teaching in the treasury', ref: 'John.8.20' }],
  },
  {
    id: 'beautiful-gate', name: 'The Beautiful Gate', plan: 'temple', aka: ['Nicanor Gate'],
    text: 'Probably the great bronze gate into the Court of the Women (or between it and the Court of Israel).',
    refs: [{ t: 'The lame man at the Beautiful Gate', ref: 'Acts.3.2' }],
  },
  {
    id: 'court-israel', name: 'Court of Israel', plan: 'temple',
    text: 'A narrow court for Israelite men, looking onto the altar.',
    refs: [{ t: 'The Pharisee and the tax collector', ref: 'Luke.18.10' }],
  },
  {
    id: 'court-priests', name: 'Court of the Priests and the altar', plan: 'temple', aka: ['altar', 'altar of burnt offering'],
    text: 'Only priests served here: the great altar of burnt offering and the bronze basin.',
    refs: [{ t: 'Between the sanctuary and the altar', ref: 'Matt.23.35' }, { t: 'Leave your gift before the altar', ref: 'Matt.5.23' }],
  },
  {
    id: 'sanctuary', name: 'The sanctuary: Holy Place and Most Holy Place', plan: 'temple', aka: ['Holy Place', 'Most Holy Place', 'Holy of Holies', 'veil', 'curtain'],
    text: 'The temple building itself. Priests burned incense in the Holy Place; behind the curtain, only the high priest entered the Most Holy Place, once a year.',
    refs: [{ t: 'Zechariah burns incense', ref: 'Luke.1.9' }, { t: 'The curtain torn in two', ref: 'Matt.27.51' }, { t: 'Through the curtain, his flesh', ref: 'Heb.10.20' }],
  },
  {
    id: 'pinnacle', name: 'Pinnacle of the temple', plan: 'temple', aka: ['pinnacle'],
    text: 'Probably the southeast corner, high above the Kidron Valley.',
    refs: [{ t: 'Set on the pinnacle', ref: 'Matt.4.5' }],
  },
  {
    id: 'temple-antonia', name: 'Fortress Antonia', plan: 'temple',
    text: 'The Roman garrison overlooked the courts from here and could reach them by stairs.',
    refs: [{ t: 'Paul rescued by the soldiers', ref: 'Acts.21.32' }],
  },
];

export const spotById = (id: string) => SPOTS.find((s) => s.id === id);

/** Place names in the app's place data that have a spot (or the whole page) on the Jerusalem page. */
export const PLACE_TO_SPOT: Record<string, string> = {
  Jerusalem: 'temple-mount',
  Gethsemane: 'gethsemane',
  Golgotha: 'golgotha',
  Kidron: 'kidron',
  'Mount of Olives': 'olives',
  Siloam: 'siloam',
  Bethesda: 'bethesda',
  Gabbatha: 'herods-palace',
  'Solomon’s Portico': 'solomons-porch',
  'Beautiful Gate': 'beautiful-gate',
  'Valley of Hinnom': 'hinnom',
  'Mount Moriah': 'temple-mount',
  'Mount Zion': 'upper-room',
  'Sheep Gate': 'bethesda',
  Ophel: 'lower-city',
};

/** Journey stops and list items that are spots rather than places. */
export const SPOT_PLACES: Record<string, string> = {
  'The temple': 'temple-mount',
  'The upper room': 'upper-room',
  "The high priest's house": 'high-priest',
  "Herod Antipas' quarters": 'hasmonean-palace',
  'The tomb': 'tomb',
};
