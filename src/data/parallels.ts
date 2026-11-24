/**
 * Parallel accounts in the Gospels ("Compare the Gospels"), compiled for this app.
 * Each passage is "Book.Chapter.First-Last" within one chapter; an account that runs over a chapter break, or
 * comes in two parts, is listed as more than one passage. So far: John's ministry and Passion Week; more events
 * can be added the same way.
 */

export interface ParallelSet {
  id: string;
  title: string;
  passages: string[];
}

export const PARALLELS: ParallelSet[] = [
  { id: 'john-ministry', title: 'John the Baptist prepares the way', passages: ['Matt.3.1-12', 'Mark.1.2-8', 'Luke.3.1-20', 'John.1.19-28'] },

  // Passion Week
  { id: 'entry', title: 'The triumphal entry', passages: ['Matt.21.1-11', 'Mark.11.1-11', 'Luke.19.28-40', 'John.12.12-19'] },
  { id: 'weeping', title: 'Jesus weeps over Jerusalem', passages: ['Luke.19.41-44', 'Matt.23.37-39'] },
  { id: 'fig-tree', title: 'The fig tree', passages: ['Matt.21.18-22', 'Mark.11.12-14', 'Mark.11.20-26'] },
  { id: 'cleansing', title: 'Cleansing the temple', passages: ['Matt.21.12-17', 'Mark.11.15-19', 'Luke.19.45-48'] },
  { id: 'authority', title: 'By what authority?', passages: ['Matt.21.23-27', 'Mark.11.27-33', 'Luke.20.1-8'] },
  { id: 'tenants', title: 'The parable of the tenants', passages: ['Matt.21.33-46', 'Mark.12.1-12', 'Luke.20.9-19'] },
  { id: 'caesar', title: 'Paying taxes to Caesar', passages: ['Matt.22.15-22', 'Mark.12.13-17', 'Luke.20.20-26'] },
  { id: 'sadducees', title: 'The Sadducees and the resurrection', passages: ['Matt.22.23-33', 'Mark.12.18-27', 'Luke.20.27-40'] },
  { id: 'greatest', title: 'The greatest commandment', passages: ['Matt.22.34-40', 'Mark.12.28-34'] },
  { id: 'davids-son', title: 'Whose son is the Christ?', passages: ['Matt.22.41-46', 'Mark.12.35-37', 'Luke.20.41-44'] },
  { id: 'scribes', title: 'Warnings about the scribes and Pharisees', passages: ['Matt.23.1-36', 'Mark.12.38-40', 'Luke.20.45-47'] },
  { id: 'widow', title: 'The widow’s offering', passages: ['Mark.12.41-44', 'Luke.21.1-4'] },
  { id: 'olivet', title: 'The destruction of the temple and the end', passages: ['Matt.24.1-51', 'Mark.13.1-37', 'Luke.21.5-36'] },
  { id: 'plot', title: 'The plot to kill Jesus', passages: ['Matt.26.1-5', 'Mark.14.1-2', 'Luke.22.1-2'] },
  { id: 'anointing', title: 'Anointed at Bethany', passages: ['Matt.26.6-13', 'Mark.14.3-9', 'John.12.1-8'] },
  { id: 'judas-agrees', title: 'Judas agrees to betray him', passages: ['Matt.26.14-16', 'Mark.14.10-11', 'Luke.22.3-6'] },
  { id: 'preparing', title: 'Preparing the Passover', passages: ['Matt.26.17-19', 'Mark.14.12-16', 'Luke.22.7-13'] },
  { id: 'betrayer', title: 'One of you will betray me', passages: ['Matt.26.20-25', 'Mark.14.17-21', 'Luke.22.21-23', 'John.13.21-30'] },
  { id: 'supper', title: 'The Lord’s Supper', passages: ['Matt.26.26-29', 'Mark.14.22-25', 'Luke.22.14-20', '1Cor.11.23-26'] },
  { id: 'peter-warned', title: 'Peter’s denial foretold', passages: ['Matt.26.30-35', 'Mark.14.26-31', 'Luke.22.31-34', 'John.13.36-38'] },
  { id: 'gethsemane', title: 'Gethsemane', passages: ['Matt.26.36-46', 'Mark.14.32-42', 'Luke.22.39-46', 'John.18.1'] },
  { id: 'arrest', title: 'The arrest', passages: ['Matt.26.47-56', 'Mark.14.43-52', 'Luke.22.47-53', 'John.18.2-12'] },
  { id: 'council', title: 'Before the high priest and the council', passages: ['Matt.26.57-68', 'Mark.14.53-65', 'Luke.22.63-71', 'John.18.13-14', 'John.18.19-24'] },
  { id: 'denials', title: 'Peter’s denials', passages: ['Matt.26.69-75', 'Mark.14.66-72', 'Luke.22.54-62', 'John.18.15-18', 'John.18.25-27'] },
  { id: 'judas-death', title: 'The death of Judas', passages: ['Matt.27.3-10', 'Acts.1.18-19'] },
  { id: 'pilate', title: 'Before Pilate', passages: ['Matt.27.11-14', 'Mark.15.2-5', 'Luke.23.1-5', 'John.18.28-38'] },
  { id: 'sentence', title: 'Barabbas and the sentence', passages: ['Matt.27.15-26', 'Mark.15.6-15', 'Luke.23.13-25', 'John.18.39-40', 'John.19.1-16'] },
  { id: 'mocked', title: 'The soldiers mock him', passages: ['Matt.27.27-31', 'Mark.15.16-20', 'John.19.2-3'] },
  { id: 'crucifixion', title: 'The crucifixion', passages: ['Matt.27.32-44', 'Mark.15.21-32', 'Luke.23.26-43', 'John.19.17-27'] },
  { id: 'death', title: 'The death of Jesus', passages: ['Matt.27.45-56', 'Mark.15.33-41', 'Luke.23.44-49', 'John.19.28-37'] },
  { id: 'burial', title: 'The burial', passages: ['Matt.27.57-61', 'Mark.15.42-47', 'Luke.23.50-56', 'John.19.38-42'] },
  { id: 'resurrection', title: 'The empty tomb', passages: ['Matt.28.1-10', 'Mark.16.1-8', 'Luke.24.1-12', 'John.20.1-10'] },
];

export interface Passage {
  book: string;
  chapter: number;
  from: number;
  to: number;
}

export function parsePassage(p: string): Passage {
  const [book, chapter, range] = p.split('.');
  const [from, to] = range.split('-').map(Number);
  return { book, chapter: Number(chapter), from, to: to ?? from };
}

/** Parallel sets with a passage containing this verse (usually one). */
export function parallelsAt(book: string, chapter: number, verse: number): ParallelSet[] {
  return PARALLELS.filter((s) =>
    s.passages.some((p) => {
      const x = parsePassage(p);
      return x.book === book && x.chapter === chapter && verse >= x.from && verse <= x.to;
    }),
  );
}
