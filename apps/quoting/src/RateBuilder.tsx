import { useState } from 'react';
import { seedRateCard, type Unit, type RateCardItem } from '@rapid-refresh/domain';
import {
  loadCustomRates, saveCustomRates, newRate, rateCostCents, rateSellCents,
  type CustomRate, type RateComponent,
} from './customRates.ts';
import { getStandardRates, setOverride, resetOverride, isOverridden } from './priceBook.ts';
import { fmt, num } from './format.ts';

const UNITS: { v: Unit; l: string }[] = [
  { v: 'm2', l: 'per m²' }, { v: 'm3', l: 'per m³' }, { v: 'lineal_m', l: 'per lineal m' },
  { v: 'each', l: 'each' }, { v: 'hour', l: 'per hour' }, { v: 'load', l: 'per load' }, { v: 'flat', l: 'flat' },
];
const unitLabel = (u: Unit) => UNITS.find((x) => x.v === u)?.l ?? u;
const MARGINS = ['0.3', '0.35', '0.4', '0.45', '0.5'];

export function RateBuilder({ onBack }: { onBack: () => void }) {
  const [rates, setRates] = useState<CustomRate[]>(() => loadCustomRates());
  const [draft, setDraft] = useState<CustomRate | null>(null);   // custom-rate editor
  const [std, setStd] = useState<RateCardItem | null>(null);     // standard-rate editor
  const [, force] = useState(0); const refresh = () => force((x) => x + 1);
  const pb = seedRateCard();

  const persist = (next: CustomRate[]) => { setRates(next); saveCustomRates(next); };
  const delCustom = (id: string) => { if (confirm('Delete this rate?')) persist(rates.filter((r) => r.id !== id)); };
  const saveCustom = () => {
    if (!draft) return;
    if (!draft.name.trim()) { alert('Give the rate a name'); return; }
    persist(rates.some((r) => r.id === draft.id) ? rates.map((r) => (r.id === draft.id ? draft : r)) : [...rates, draft]);
    setDraft(null);
  };
  const setD = (patch: Partial<CustomRate>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setComp = (i: number, patch: Partial<RateComponent>) =>
    setDraft((d) => (d ? { ...d, components: d.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : d));
  const prefill = (i: number, id: string) => {
    const it = pb.find((x) => x.id === id); if (!it) return;
    setComp(i, { label: it.label, unitCostCents: it.costRateCents ?? it.sellRateCents ?? 0, levy: it.type === 'material' });
  };

  // ---- standard-rate editor ----
  if (std) {
    const m = std.defaultPricing.method;
    const saveStd = () => {
      const patch: any = { costRateCents: std.costRateCents, costRateGstInclusive: std.costRateGstInclusive, active: std.active };
      if (m === 'charge') { patch.sellRateCents = std.sellRateCents; patch.defaultPricing = { method: 'charge', sellRateCents: std.sellRateCents || 0 }; }
      else if (m === 'margin') patch.defaultPricing = std.defaultPricing;
      setOverride(std.key, patch); setStd(null); refresh();
    };
    return (
      <div className="card">
        <h3>Edit rate</h3>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{std.label}</div>
        <div className="muted small" style={{ marginBottom: 10 }}>{unitLabel(std.unit)} · {m === 'charge' ? 'fixed sell rate' : m === 'margin' ? 'margin on cost' : 'at cost'}</div>

        <div className="row tight">
          <label className="field" style={{ flex: 1 }}><span>Cost rate $ / {unitLabel(std.unit).replace('per ', '')}</span>
            <input className="input" inputMode="decimal" value={std.costRateCents != null ? String(std.costRateCents / 100) : ''}
              onChange={(e) => setStd({ ...std, costRateCents: e.target.value.trim() === '' ? null : Math.round(num(e.target.value) * 100) })} placeholder="—" />
          </label>
          <label className="row tight" style={{ marginTop: 14 }}><input type="checkbox" checked={std.costRateGstInclusive} onChange={(e) => setStd({ ...std, costRateGstInclusive: e.target.checked })} /> GST-incl</label>
        </div>

        {m === 'charge' && (
          <label className="field"><span>Sell rate $ / {unitLabel(std.unit).replace('per ', '')}</span>
            <input className="input" inputMode="decimal" value={std.sellRateCents != null ? String(std.sellRateCents / 100) : ''}
              onChange={(e) => setStd({ ...std, sellRateCents: Math.round(num(e.target.value) * 100) })} />
          </label>
        )}
        {m === 'margin' && (
          <label className="field"><span>Margin</span>
            <select className="input" value={String(std.defaultPricing.method === 'margin' ? std.defaultPricing.rate : 0.4)}
              onChange={(e) => setStd({ ...std, defaultPricing: { method: 'margin', rate: num(e.target.value) } })}>
              {MARGINS.map((x) => <option key={x} value={x}>{Math.round(+x * 100)}%</option>)}
            </select>
          </label>
        )}

        <label className="row tight" style={{ marginTop: 4 }}><input type="checkbox" checked={std.active} onChange={(e) => setStd({ ...std, active: e.target.checked })} /> Active (show in picker)</label>
        {std.notes && <p className="muted small" style={{ marginTop: 6 }}>{std.notes}</p>}

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={saveStd}>Save</button>
          {isOverridden(std.key) && <button className="btn secondary" onClick={() => { resetOverride(std.key); setStd(null); refresh(); }}>Reset to default</button>}
          <button className="btn secondary" onClick={() => setStd(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---- custom-rate editor ----
  if (draft) {
    const isEdit = rates.some((r) => r.id === draft.id);
    const cost = rateCostCents(draft), sell = rateSellCents(draft);
    const per = unitLabel(draft.unit).replace('per ', '');
    return (
      <div className="card">
        <h3>{isEdit ? 'Edit' : 'New'} custom rate</h3>
        <label className="field"><span>Name</span>
          <input className="input" value={draft.name} onChange={(e) => setD({ name: e.target.value })} placeholder="e.g. Bark garden (supply & spread)" />
        </label>
        <div className="grid2">
          <label className="field"><span>Unit</span>
            <select className="input" value={draft.unit} onChange={(e) => setD({ unit: e.target.value as Unit })}>
              {UNITS.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
            </select>
          </label>
          <label className="field"><span>Margin</span>
            <select className="input" value={String(draft.marginRate)} onChange={(e) => setD({ marginRate: num(e.target.value) })}>
              {MARGINS.map((x) => <option key={x} value={x}>{Math.round(+x * 100)}%</option>)}
            </select>
          </label>
        </div>
        <div className="muted small" style={{ margin: '10px 0 4px' }}>Components — cost per 1 {per}:</div>
        {draft.components.map((c, i) => (
          <div key={i} className="preview" style={{ marginBottom: 6 }}>
            <select className="input" style={{ marginBottom: 4 }} value="" onChange={(e) => prefill(i, e.target.value)}>
              <option value="">— prefill from price book —</option>
              {pb.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <input className="input" style={{ marginBottom: 4 }} value={c.label} onChange={(e) => setComp(i, { label: e.target.value })} placeholder="Component (e.g. Black bark)" />
            <div className="row tight">
              <label className="field" style={{ flex: 1 }}><span>Qty /{per}</span><input className="input" inputMode="decimal" value={String(c.qty)} onChange={(e) => setComp(i, { qty: num(e.target.value) })} /></label>
              <label className="field" style={{ flex: 1 }}><span>$ each</span><input className="input" inputMode="decimal" value={c.unitCostCents ? String(c.unitCostCents / 100) : ''} onChange={(e) => setComp(i, { unitCostCents: Math.round(num(e.target.value) * 100) })} /></label>
              <label className="row tight" style={{ marginTop: 14, whiteSpace: 'nowrap' }}><input type="checkbox" checked={!!c.levy} onChange={(e) => setComp(i, { levy: e.target.checked })} /> levy</label>
              <button className="x" style={{ marginTop: 14 }} title="Remove" onClick={() => setD({ components: draft.components.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <div className="muted small" style={{ textAlign: 'right' }}>= {fmt(Math.round((c.qty || 0) * (c.unitCostCents || 0) * (c.levy ? 1.07 : 1)))}</div>
          </div>
        ))}
        <button className="btn ghost block sm" onClick={() => setD({ components: [...draft.components, { label: '', qty: 1, unitCostCents: 0, levy: false }] })}>+ Add component</button>
        <div className="preview" style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Cost {fmt(cost)} /{per}</span>
            <span><b>Sell {fmt(sell)} /{per}</b> · {Math.round(draft.marginRate * 100)}%</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={saveCustom}>Save rate</button>
          <button className="btn secondary" onClick={() => setDraft(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---- list ----
  const standards = getStandardRates();
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn secondary sm" onClick={onBack}>← Quotes</button>
          <button className="btn sm" onClick={() => setDraft(newRate())}>+ Custom rate</button>
        </div>
        <h2 style={{ marginTop: 10 }}>Price book</h2>
        <p className="muted small">Edit any rate or build your own — saved on this device and used when quoting.</p>
      </div>

      <div className="card">
        <h3>Your custom rates</h3>
        {rates.length === 0 && <div className="muted small">None yet. Tap “+ Custom rate”.</div>}
        {rates.map((r) => (
          <div className="line" key={r.id}>
            <div className="desc" style={{ cursor: 'pointer' }} onClick={() => setDraft(JSON.parse(JSON.stringify(r)))}>
              <div>{r.name || '(unnamed)'} <span className="muted small">✎</span></div>
              <div className="qty">cost {fmt(rateCostCents(r))} · {Math.round(r.marginRate * 100)}% · {unitLabel(r.unit)}</div>
            </div>
            <div className="sell">{fmt(rateSellCents(r))}</div>
            <button className="x" title="Delete" onClick={() => delCustom(r.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Standard rates</h3>
        {standards.map((it) => (
          <div className="line" key={it.key} onClick={() => setStd({ ...it })} style={{ cursor: 'pointer' }}>
            <div className="desc">
              <div>{it.label} {isOverridden(it.key) && <span className="muted small">· edited</span>} <span className="muted small">✎</span></div>
              <div className="qty">{unitLabel(it.unit)} · {it.defaultPricing.method === 'charge' ? `sell ${fmt(it.sellRateCents || 0)}` : it.defaultPricing.method === 'margin' ? `cost ${it.costRateCents != null ? fmt(it.costRateCents) : '—'} · ${Math.round(it.defaultPricing.rate * 100)}%` : 'at cost'}</div>
            </div>
            <div className="sell">{it.sellRateCents != null ? fmt(it.sellRateCents) : (it.costRateCents != null ? fmt(it.costRateCents) : '')}</div>
          </div>
        ))}
      </div>
    </>
  );
}
