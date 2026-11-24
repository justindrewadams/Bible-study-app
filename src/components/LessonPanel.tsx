/**
 * Playing a class lesson: the current step's heading and notes, Prev / Next (and the arrow keys or a
 * clicker while presenting), the whole list of steps, and for shared lessons the reminder that a user made
 * it, "Save a copy", "Report" and, for administrators, "Remove". Also the disclaimer shown before a shared
 * lesson starts, and the report form.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/account';
import type { OpenLesson } from '../lib/lessons';
import type { LessonStep } from '../lib/notes';
import type { Span } from '../lib/refs';
import { stepSummary, STEP_KINDS } from './LessonEditor';
import NoteText from './NoteText';
import Turnstile from './Turnstile';

export const DISCLAIMER =
  'This lesson was made by someone using Ancient Pathfinder, not by the app itself. Please check everything in it by studying the Scriptures, the only inspired writings, by which we are to live.';

interface Props {
  lesson: OpenLesson;
  index: number;
  onGo: (i: number) => void;
  onClose: () => void;
  onOpenRef: (s: Span) => void;
  /** re-open a step's page or link (the step's own action) */
  onAction: (step: LessonStep) => void;
  signedIn: boolean;
  isAdmin: boolean;
  onSaveCopy: () => Promise<void>;
  onRemoved: () => void;
}

export default function LessonPanel({ lesson, index, onGo, onClose, onOpenRef, onAction, signedIn, isAdmin, onSaveCopy, onRemoved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const step = lesson.steps[index];
  const last = lesson.steps.length - 1;
  useEffect(() => {
    listRef.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }, [index, expanded]);
  if (!step) return null;
  const shared = lesson.kind === 'shared';
  const action =
    step.type === 'page' ? `Open ${step.label || 'the page'}` : step.type === 'link' ? `Open link ↗` : null;

  return (
    <div className="list-panel lesson-panel" style={{ '--c': '#1971c2' } as React.CSSProperties}>
      <div className="lp-head">
        <div className="lp-title">
          <span className="lp-kicker">Lesson</span> {lesson.title || 'Lesson'}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close lesson">
          ✕
        </button>
      </div>
      {shared && (
        <p className="lesson-made-by small">
          Made by {lesson.author ? <strong>{lesson.author}</strong> : 'a user'} · please check it with Scripture
        </p>
      )}

      <div className="lp-item">
        <span className="lp-num">{index + 1}</span>
        <div className="lp-body">
          <div className="lp-name">{step.title || stepSummary(step)}</div>
          {step.title && <div className="lp-meta">{stepSummary(step)}</div>}
          {step.note.trim() && <NoteText text={step.note} onOpenRef={onOpenRef} className="lesson-note" />}
          {action && (
            <button className="btn lesson-action" onClick={() => onAction(step)}>
              {action}
            </button>
          )}
          {step.type === 'link' && step.url && (
            <div className="muted small">
              Leaves Ancient Pathfinder for {(() => {
                try {
                  return new URL(step.url).hostname;
                } catch {
                  return 'another website';
                }
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="jp-controls">
        <button className="btn" onClick={() => onGo(index - 1)} disabled={index === 0} aria-label="Previous step">
          ‹<span className="jp-label"> Prev</span>
        </button>
        <button className="btn primary" onClick={() => onGo(index + 1)} disabled={index === last} aria-label="Next step">
          <span className="jp-label">Next </span>›
        </button>
        <span className="jp-count">
          {index + 1}/{last + 1}
        </span>
        <button className="link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide steps' : 'All steps'}
        </button>
      </div>

      {expanded && (
        <>
          {lesson.summary && <p className="lp-summary">{lesson.summary}</p>}
          <ol className="jp-list lp-list" ref={listRef}>
            {lesson.steps.map((s, i) => (
              <li key={i} className={i === index ? 'current' : i < index ? 'past' : ''}>
                <button onClick={() => onGo(i)}>
                  <span className="jp-li-num">{i + 1}</span> {s.title || stepSummary(s)}
                  <span className="muted"> · {STEP_KINDS.find((k) => k.type === s.type)?.label}</span>
                </button>
              </li>
            ))}
          </ol>
          {shared && (
            <div className="lesson-shared-tools small">
              {signedIn && (
                <button
                  className="link-button"
                  onClick={async () => {
                    try {
                      await onSaveCopy();
                      setMsg('Saved to your My Content.');
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : 'Couldn’t save a copy.');
                    }
                  }}
                >
                  Save a copy
                </button>
              )}
              <button className="link-button" onClick={() => setReporting(true)}>
                Report this lesson
              </button>
              {isAdmin && (
                <button
                  className="link-button notes-danger"
                  onClick={async () => {
                    if (!confirm('Remove this shared lesson? Its link stops working for everyone. The person who made it keeps their copy.')) return;
                    try {
                      await api('/shared/remove', { id: lesson.id });
                      onRemoved();
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : 'Couldn’t remove it.');
                    }
                  }}
                >
                  Remove (administrator)
                </button>
              )}
            </div>
          )}
          {msg && <p className="small acct-ok">{msg}</p>}
        </>
      )}
      {reporting && <ReportForm shareId={lesson.id} onClose={() => setReporting(false)} />}
    </div>
  );
}

/** Shown before a shared lesson starts. */
export function LessonIntro({ lesson, onStart, onCancel }: { lesson: OpenLesson; onStart: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal acct lesson-intro" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={lesson.title}>
        <p className="lp-kicker">Shared lesson</p>
        <h2>{lesson.title || 'Lesson'}</h2>
        {lesson.author && <p className="small muted">Shared by {lesson.author}</p>}
        {lesson.summary && <p>{lesson.summary}</p>}
        <p className="lesson-disclaimer">{DISCLAIMER}</p>
        <p className="small muted">
          {lesson.steps.length} step{lesson.steps.length === 1 ? '' : 's'}. Passages show in the translation you read.
        </p>
        <div className="acct-actions">
          <button className="btn primary" onClick={onStart}>
            Start the lesson
          </button>
          <button className="btn" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportForm({ shareId, onClose }: { shareId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [ts, setTs] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal acct" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Report this lesson">
        <div className="acct-head">
          <h2>Report this lesson</h2>
          <button className="acct-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {done ? (
          <>
            <p>Thank you. The site’s administrators have been told and will look at it.</p>
            <button className="btn primary" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <form
            className="acct-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ts) return setError('Please wait for the “verify you are human” check to finish.');
              setBusy(true);
              setError(null);
              try {
                await api('/shared/report', { id: shareId, reason, turnstile: ts });
                setDone(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Couldn’t send the report.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="acct-field">
              <span className="acct-label">What’s wrong? (optional)</span>
              <textarea className="note-area" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} />
            </label>
            <Turnstile onToken={setTs} />
            {error && <p className="acct-error">{error}</p>}
            <div className="acct-actions">
              <button className="btn primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send report'}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
