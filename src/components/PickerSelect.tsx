import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface PickerGroup {
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  groups: PickerGroup[];
  /** the empty choice, e.g. "Follow a journey…" */
  placeholder: string;
  /** in the menu, the empty choice when something is chosen, e.g. "Stop following" */
  clearLabel: string;
  className?: string;
  ariaLabel: string;
}

/** Computers with a mouse get the app's own menu; phones and tablets keep the system picker. */
const WIDE = '(min-width: 861px) and (hover: hover) and (pointer: fine)';

/**
 * A <select> whose menu, on computers, is drawn by the app: it always opens below the box at full height, with the
 * chosen item ticked and scrolled to the middle. (A Mac's own menu lines the chosen item up with the box, which can
 * push the menu off the top of the screen.) The real <select> stays for its look, phones and keyboard focus.
 */
export default function PickerSelect({ value, onChange, groups, placeholder, clearLabel, className, ariaLabel }: Props) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const custom = () => window.matchMedia(WIDE).matches;

  const openMenu = () => {
    const r = selectRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 300);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const top = r.bottom + 4;
    setPos({ top, left, width, maxHeight: Math.max(200, window.innerHeight - top - 12) });
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) selectRef.current?.focus();
  };
  const choose = (v: string) => {
    close();
    if (v !== value) onChange(v);
  };

  // put the chosen item in the middle of the menu, and focus it for the keyboard
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const on = menu?.querySelector<HTMLElement>('[aria-selected="true"]') ?? menu?.querySelector<HTMLElement>('[role="option"]');
    if (!menu || !on) return;
    menu.scrollTop = on.offsetTop - menu.clientHeight / 2 + on.offsetHeight / 2;
    on.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !selectRef.current?.contains(t)) close(false);
    };
    const away = () => close(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', away);
    window.addEventListener('blur', away);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', away);
      window.removeEventListener('blur', away);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMenuKey = (e: ReactKeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (k: number) => items[Math.max(0, Math.min(items.length - 1, k))]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') close(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <select
        ref={selectRef}
        className={className}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => {
          if (!custom()) return;
          e.preventDefault(); // no system menu
          if (open) close();
          else openMenu();
        }}
        onKeyDown={(e) => {
          if (!custom()) return;
          // (not Space: its key-up would pick the item the menu opens on)
          if (['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        <option value="">{placeholder}</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="picker-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            onKeyDown={onMenuKey}
          >
            {value && (
              <button role="option" aria-selected={false} className="picker-option picker-clear" onClick={() => choose('')}>
                {clearLabel}
              </button>
            )}
            {groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className="picker-group">{g.label}</div>
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    role="option"
                    aria-selected={o.value === value}
                    className={`picker-option${o.value === value ? ' on' : ''}`}
                    onClick={() => choose(o.value)}
                  >
                    <span className="picker-check" aria-hidden="true">
                      {o.value === value ? '✓' : ''}
                    </span>
                    {o.label}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
