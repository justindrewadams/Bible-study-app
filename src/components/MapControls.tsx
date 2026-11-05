import { useState } from 'react';
import { BASE_LAYER_OPTIONS, type MapSettings, type ModernOverlay } from './MapView';

interface Props {
  settings: MapSettings;
  onChange: (s: MapSettings) => void;
}

export default function MapControls({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof MapSettings>(k: K, v: MapSettings[K]) => onChange({ ...settings, [k]: v });
  const modernOn = settings.modern !== 'off';

  return (
    <div className="map-controls">
      <button
        className={`overlay-toggle${modernOn ? ' on' : ''}`}
        onClick={() => set('modern', modernOn ? 'off' : 'labels')}
        title="Overlay today's borders, cities and roads"
        aria-pressed={modernOn}
      >
        {modernOn ? '◉' : '○'} Modern map
      </button>
      <button className="icon-btn layers-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Map layers">
        ☰
      </button>
      {open && (
        <div className="layers-panel">
          <div className="group">
            <div className="group-title">Base map</div>
            {BASE_LAYER_OPTIONS.map((b) => (
              <label key={b.id} className="radio">
                <input type="radio" name="base" checked={settings.base === b.id} onChange={() => set('base', b.id)} />
                {b.label}
              </label>
            ))}
          </div>
          <div className="group">
            <div className="group-title">Modern overlay</div>
            {(
              [
                ['off', 'Off'],
                ['labels', 'Borders & place names'],
                ['full', 'Full street map'],
              ] as [ModernOverlay, string][]
            ).map(([id, label]) => (
              <label key={id} className="radio">
                <input type="radio" name="modern" checked={settings.modern === id} onChange={() => set('modern', id)} />
                {label}
              </label>
            ))}
            <label className="slider">
              Opacity
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={settings.modernOpacity}
                disabled={!modernOn}
                onChange={(e) => set('modernOpacity', Number(e.target.value))}
              />
            </label>
          </div>
          <div className="group">
            <label className="check">
              <input type="checkbox" checked={settings.regions} onChange={(e) => set('regions', e.target.checked)} />
              Ancient region names
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.chapterPlaces}
                onChange={(e) => set('chapterPlaces', e.target.checked)}
              />
              All places in this chapter
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
