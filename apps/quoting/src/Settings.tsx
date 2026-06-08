import { useState } from 'react';
import { getBusiness, saveBusiness, type Business } from './settings.ts';
import { getPriceBookUrl, setPriceBookUrl } from './priceBook.ts';

export function Settings({ onBack }: { onBack: () => void }) {
  const [b, setB] = useState<Business>(() => getBusiness());
  const [pbUrl, setPbUrl] = useState<string>(() => getPriceBookUrl());
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Business, v: string) => { setB({ ...b, [k]: v }); setSaved(false); };
  const save = () => { saveBusiness(b); setPriceBookUrl(pbUrl); setSaved(true); };

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

      <label className="field">
        <span>Live price-book URL (published CSV of the PriceBook sheet)</span>
        <input className="input" value={pbUrl} onChange={(e) => { setPbUrl(e.target.value); setSaved(false); }} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv" />
      </label>
      <p className="muted small" style={{ marginTop: -4 }}>In the sheet: File → Share → Publish to web → PriceBook → CSV → paste the link here. Leave blank to use built-in rates.</p>

      <button className="btn block" onClick={save}>{saved ? '✓ Saved' : 'Save'}</button>
    </div>
  );
}
