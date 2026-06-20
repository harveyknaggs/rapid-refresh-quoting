import { useState } from 'react';
import { getBusiness, saveBusiness, type Business } from './settings.ts';

export function Settings({ onBack }: { onBack: () => void }) {
  const [b, setB] = useState<Business>(() => getBusiness());
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Business, v: string) => { setB({ ...b, [k]: v }); setSaved(false); };
  const save = () => { saveBusiness(b); setSaved(true); };

  const field = (k: keyof Business, label: string, area = false) => (
    <label className="field">
      <span>{label}</span>
      {area
        ? <textarea className="input" rows={2} value={b[k]} onChange={(e) => set(k, e.target.value)} />
        : <input className="input" value={b[k]} onChange={(e) => set(k, e.target.value)} />}
    </label>
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Business details</h2>
        <button className="btn secondary sm" onClick={onBack}>← Back</button>
      </div>
      <p className="muted small">Shown on client quote documents. Stored on this device.</p>
      {field('name', 'Business name')}
      {field('gstNumber', 'GST number')}
      <div className="grid2">{field('email', 'Email')}{field('phone', 'Phone')}</div>
      {field('terms', 'Default terms', true)}
      {field('deposit', 'Deposit terms', true)}

      <p className="muted small">Rates are managed in <b>Rates</b> (top bar) — edit any rate or build your own; saved on this device.</p>
      <p className="muted small">The “Describe the job” AI builder works automatically — no API key needed.</p>

      <button className="btn block" onClick={save}>{saved ? '✓ Saved' : 'Save'}</button>
    </div>
  );
}
