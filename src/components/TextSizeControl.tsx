import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Bible text sizes the reader can step through (1 = the original size). */
export const TEXT_SIZES = [1, 1.12, 1.25, 1.4, 1.6];

export interface TextPrefs {
  size: number;
  bold: boolean;
}

// One setting for the whole app (the reader, Compare the accounts…), remembered on this device.
const KEY = 'textPrefs';
const DEFAULTS: TextPrefs = { size: 0, bold: false };
const listeners = new Set<() => void>();
let current: TextPrefs = (() => {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...DEFAULTS, ...JSON.parse(s) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
})();

function setPrefs(next: TextPrefs) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** The shared text size and bolder-text setting; every place that shows Bible text updates together. */
export function useTextPrefs() {
  const prefs = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const sizeStep = Math.min(Math.max(Math.round(prefs.size) || 0, 0), TEXT_SIZES.length - 1);
  return { prefs, sizeStep, scale: TEXT_SIZES[sizeStep], setPrefs };
}

/** The "AA" button and its pop-up: text size steps and "Bolder text". */
export default function TextSizeControl({ className }: { className?: string }) {
  const { prefs, sizeStep, setPrefs } = useTextPrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      e.stopPropagation(); // close only this pop-up, not the window it sits in
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={`text-prefs${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        className="hymns-btn text-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Text size"
        aria-label="Text size"
      >
        <span className="text-btn-small">A</span>A
      </button>
      {open && (
        <div className="text-pop" role="dialog" aria-label="Text size">
          <div className="text-pop-row">
            <span className="text-pop-label">Text size</span>
            <button
              className="text-step"
              onClick={() => setPrefs({ ...prefs, size: sizeStep - 1 })}
              disabled={sizeStep === 0}
              aria-label="Smaller text"
            >
              A−
            </button>
            <span className="text-dots" aria-label={`Size ${sizeStep + 1} of ${TEXT_SIZES.length}`}>
              {TEXT_SIZES.map((_, i) => (
                <span key={i} className={i <= sizeStep ? 'on' : ''} />
              ))}
            </span>
            <button
              className="text-step big"
              onClick={() => setPrefs({ ...prefs, size: sizeStep + 1 })}
              disabled={sizeStep === TEXT_SIZES.length - 1}
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
          <label className="text-pop-row text-bold">
            <input type="checkbox" checked={prefs.bold} onChange={(e) => setPrefs({ ...prefs, bold: e.target.checked })} />
            Bolder text
          </label>
        </div>
      )}
    </div>
  );
}
