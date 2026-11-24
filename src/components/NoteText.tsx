/**
 * Shows a note's writing with its simple formatting and tappable verse links.
 *
 * The formatting is kept as plain text (a small Markdown subset), and drawn here as React elements, never
 * as HTML, so nothing typed into a note can run as code:
 *   **bold**   *italic*   # Heading   ## Smaller heading   - bullet   1. numbered   > quote
 */
import { Fragment, type ReactNode } from 'react';
import { findRefs, spanLabel, type Span } from '../lib/refs';

interface Props {
  text: string;
  onOpenRef: (span: Span) => void;
  className?: string;
}

function inline(text: string, onOpenRef: (s: Span) => void, key = ''): ReactNode[] {
  // bold first, then italic, then verse links inside plain text
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])|(?<![_\w])_(?!\s)(.+?)(?<!\s)_(?![_\w])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const plain = (s: string) => {
    let at = 0;
    for (const r of findRefs(s)) {
      if (r.start > at) out.push(s.slice(at, r.start));
      out.push(
        <button
          key={`${key}r${i++}`}
          type="button"
          className="note-ref"
          title={`Read ${spanLabel(r)}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenRef(r);
          }}
        >
          {s.slice(r.start, r.end)}
        </button>,
      );
      at = r.end;
    }
    if (at < s.length) out.push(s.slice(at));
  };
  while ((m = re.exec(text))) {
    if (m.index > last) plain(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={`${key}b${i++}`}>{inline(m[1], onOpenRef, `${key}b${i}`)}</strong>);
    else out.push(<em key={`${key}i${i++}`}>{inline(m[2] ?? m[3], onOpenRef, `${key}i${i}`)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return out;
}

export default function NoteText({ text, onOpenRef, className }: Props) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    const k = blocks.length;
    if (para.length) {
      blocks.push(
        <p key={k}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, onOpenRef, `${k}.${i}`)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
    if (list) {
      const items = list.items.map((l, i) => <li key={i}>{inline(l, onOpenRef, `${k}l${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={`${k}o`}>{items}</ol> : <ul key={`${k}u`}>{items}</ul>);
      list = null;
    }
    if (quote.length) {
      blocks.push(
        <blockquote key={`${k}q`}>
          {quote.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, onOpenRef, `${k}q${i}`)}
            </Fragment>
          ))}
        </blockquote>,
      );
      quote = [];
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    if (!line.trim()) {
      flush();
    } else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      flush();
      const k = blocks.length;
      blocks.push(
        m[1].length === 1 ? (
          <h3 key={k}>{inline(m[2], onOpenRef, `${k}h`)}</h3>
        ) : (
          <h4 key={k}>{inline(m[2], onOpenRef, `${k}h`)}</h4>
        ),
      );
    } else if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      if (para.length || quote.length || (list && list.ordered)) flush();
      list ??= { ordered: false, items: [] };
      list.items.push(m[1]);
    } else if ((m = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line))) {
      if (para.length || quote.length || (list && !list.ordered)) flush();
      list ??= { ordered: true, items: [] };
      list.items.push(m[1]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (para.length || list) flush();
      quote.push(m[1]);
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return <div className={`note-text${className ? ` ${className}` : ''}`}>{blocks}</div>;
}
