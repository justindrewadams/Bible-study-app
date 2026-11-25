/**
 * Around the lesson page (LessonPage.tsx): the slim bar that brings you back to a lesson after you step out
 * of it (to read a chapter, follow a journey or look at the big map), the disclaimer shown before a shared
 * lesson starts, and the report form.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/account';
import type { OpenLesson } from '../lib/lessons';
import Turnstile from './Turnstile';

export const DISCLAIMER =
  'This lesson was made by someone using Ancient Pathfinder, not by the app itself. Please check everything in it by studying the Scriptures, the only inspired writings, by which we are to live.';

/** Shown in place of the lesson while you're reading or on the map: back to the lesson, or close it. */
export default function LessonReturn({ lesson, onBack, onClose }: { lesson: OpenLesson; onBack: () => void; onClose: () => void }) {
  return (
    <div className="list-panel lesson-panel lesson-return" style={{ '--c': '#1971c2' } as React.CSSProperties}>
      <div className="lp-head">
        <div className="lp-title">
          <span className="lp-kicker">Lesson</span> {lesson.title || 'Lesson'}
        </div>
        <span className="lesson-return-tools">
          <button className="btn primary" onClick={onBack}>
            ‹ Back to the lesson
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close lesson">
            ✕
          </button>
        </span>
      </div>
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

export function ReportForm({ shareId, onClose }: { shareId: string; onClose: () => void }) {
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
