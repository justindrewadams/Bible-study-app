/**
 * Preferences, at the top of the account page: text size, bolder text, default translation and map style.
 * They are the same settings as the "AA" button, the translation menu and the map's layers button; when
 * signed in they are saved to the account and follow you to your other devices (see App.tsx).
 */
import { APIBIBLE_TRANSLATIONS, BIBLE_API_TRANSLATIONS, ESV_TRANSLATION, OPEN_TRANSLATIONS } from '../lib/bible';
import { BASE_LAYER_OPTIONS, type MapSettings, type ModernOverlay } from './MapView';
import { TEXT_SIZES, useTextPrefs } from './TextSizeControl';

interface Props {
  translationId: string;
  onTranslation: (id: string) => void;
  map: MapSettings;
  onMap: (m: MapSettings) => void;
}

const MODERN: [ModernOverlay, string][] = [
  ['off', 'Off'],
  ['labels', 'Borders & place names'],
  ['full', 'Full street map'],
];

export default function Preferences({ translationId, onTranslation, map, onMap }: Props) {
  const { prefs, sizeStep, setPrefs } = useTextPrefs();
  const setMap = <K extends keyof MapSettings>(k: K, v: MapSettings[K]) => onMap({ ...map, [k]: v });
  return (
    <div className="prefs">
      <div className="prefs-row">
        <span className="prefs-label">Text size</span>
        <span className="prefs-size">
          <button
            type="button"
            className="btn"
            onClick={() => setPrefs({ ...prefs, size: Math.max(0, sizeStep - 1) })}
            disabled={sizeStep === 0}
            aria-label="Smaller text"
          >
            A−
          </button>
          <span className="prefs-size-n" aria-live="polite">
            {sizeStep + 1} of {TEXT_SIZES.length}
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => setPrefs({ ...prefs, size: Math.min(TEXT_SIZES.length - 1, sizeStep + 1) })}
            disabled={sizeStep === TEXT_SIZES.length - 1}
            aria-label="Larger text"
          >
            A+
          </button>
        </span>
      </div>
      <label className="acct-check">
        <input type="checkbox" checked={prefs.bold} onChange={(e) => setPrefs({ ...prefs, bold: e.target.checked })} />
        <span>Bolder text</span>
      </label>
      <p
        className="prefs-sample"
        style={{ fontSize: `${1.05 * TEXT_SIZES[sizeStep]}rem`, fontWeight: prefs.bold ? 500 : 400 }}
        aria-hidden
      >
        In the beginning God created the heaven and the earth. <span className="muted small">(KJV sample)</span>
      </p>

      <label className="note-meta">
        <span>Translation</span>
        <select value={translationId} onChange={(e) => onTranslation(e.target.value)}>
          <optgroup label="Licensed (Crossway's official ESV API)">
            <option value={ESV_TRANSLATION.id}>ESV — {ESV_TRANSLATION.name}</option>
          </optgroup>
          {APIBIBLE_TRANSLATIONS.length > 0 && (
            <optgroup label="Licensed (through API.Bible)">
              {APIBIBLE_TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code === 'NASB1995' ? 'NASB 1995' : t.code} — {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {OPEN_TRANSLATIONS.length > 0 && (
            <optgroup label="Freely licensed">
              {OPEN_TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Public domain">
            {BIBLE_API_TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code.toUpperCase()} — {t.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="note-meta-row">
        <label className="note-meta grow">
          <span>Map style</span>
          <select value={map.base} onChange={(e) => setMap('base', e.target.value as MapSettings['base'])}>
            {BASE_LAYER_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="note-meta grow">
          <span>Modern map on top</span>
          <select value={map.modern} onChange={(e) => setMap('modern', e.target.value as ModernOverlay)}>
            {MODERN.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="acct-check">
        <input type="checkbox" checked={map.regions} onChange={(e) => setMap('regions', e.target.checked)} />
        <span>Ancient region names</span>
      </label>
      <label className="acct-check">
        <input type="checkbox" checked={map.chapterPlaces} onChange={(e) => setMap('chapterPlaces', e.target.checked)} />
        <span>All places in the chapter on the map</span>
      </label>
      <p className="small muted prefs-note">Saved to your account, so your other devices use them too.</p>
    </div>
  );
}
