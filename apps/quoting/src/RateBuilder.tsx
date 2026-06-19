import { useState } from 'react';
import { seedRateCard, type Unit } from '@rapid-refresh/domain';
import {
  loadCustomRates, saveCustomRates, newRate, rateCostCents, rateSellCents,
  type CustomRate, type RateComponent,
} from './customRates.ts';
import { fmt, num } from './format.ts';

const UNITS: { v: Unit; l: string }[] = [
  { v: 'm2', l: 'per m²' }, { v: 'm3', l: 'per m³' }, { v: 'lineal_m', l: 'per lineal m' },
  { v: 'each', l: 'each' }, { v: 'hour', l: 'per hour' }, { v: 'load', l: 'per load' }, { v: 'flat', l: 'flat' },
];
const unitLabel = (u: Unit) => UNITS.find((x) => x.v === u)?.l ?? u;

export function RateBuilder({ onBack }: { onBack: () => void }) {
  const [rates, setRates] = useState<CustomRate[]>(() => loadCustomRates());
  const [draft, setDraft] = useState<CustomRate | null>(null);
  const pb = seedRateCard();

  const persist = (next: CustomRate[]) => { setRates(next); saveCustomRates(next); };
  const del = (id: string) => { if (confirm('Delete this rate?')) persist(rates.filter((r) => r.id !== id)); };
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) { alert('Give the rate a name'); return; }
    persist(rates.some((r) => r.id === draft.id) ? rates.map((r) => (r.id === draft.id ? draft : r)) : [...rates, draft]);
    setDraft(null);
  };

  const setD = (patch: Partial<CustomRate>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setComp = (i: number, patch: Partial<RateComponent>) =>
    setDraft((d) => (d ? { ...d, components: d.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : d));
  const addComp = () => setDraft((d) => (d ? { ...d, components: [...d.components, { label: '', qty: 1, unitCostCents: 0, levy: false }] } : d));
  const removeComp = (i: number) => setDraft((d) => (d ? { ...d, components: d.components.filter((_, j) => j !== i) } : d));
  const prefill = (i: number, id: string) => {
    const it = pb.find((x) => x.id === id); if (!it) return;
    setComp(i, { label: it.label, unitCostCents: it.costRateCents ?? it.sellRateCents ?? 0, levy: it.type === 'material' });
  };

  // ---- list ----
  if (!draft) {
    return (
      <>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn secondary sm" onClick={onBack}>← Quotes</button>
            <button className="btn sm" onClick={() => setDraft(newRate())}>+ New rate</button>
          </div>
          <h2 style={{ marginTop: 10 }}>Rate builder</h2>
          <p className="muted small">Build a per-unit rate from component costs + margin. Saved rates appear in the line picker when quoting.</p>
        </div>
        <div className="card">
          {rates.length === 0 && <div className="muted">No custom rates yet. Tap “+ New rate”.</div>}
          {rates.map((r) => (
            <div className="line" key={r.id}>
              <div className="desc" style={{ cursor: 'pointer' }} onClick={() => setDraft(JSON.parse(JSON.stringify(r)))}>
                <div>{r.name || '(unnamed)'} <span className="muted small">✎</span></div>
                <div className="qty">cost {fmt(rateCostCents(r))} · {Math.round(r.marginRate * 100)}% · {unitLabel(r.unit)}</div>
              </div>
              <div className="sell">{fmt(rateSellCents(r))}</div>
              <button className="x" title="Delete" onClick={() => del(r.id)}>✕</button>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ---- edit ----
  const isEdit = rates.some((r) => r.id === draft.id);
  const cost = rateCostCents(draft), sell = rateSellCents(draft);
  const per = unitLabel(draft.unit).replace('per ', '');
  return (
    <div className="card">
      <h3>{isEdit ? 'Edit' : 'New'} rate</h3>
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
            <option value="0.4">40%</option><option value="0.35">35%</option><option value="0.3">30%</option><option value="0.45">45%</option><option value="0.5">50%</option>
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
            <button className="x" style={{ marginTop: 14 }} title="Remove" onClick={() => removeComp(i)}>✕</button>
          </div>
          <div className="muted small" style={{ textAlign: 'right' }}>= {fmt(Math.round((c.qty || 0) * (c.unitCostCents || 0) * (c.levy ? 1.07 : 1)))}</div>
        </div>
      ))}
      <button className="btn ghost block sm" onClick={addComp}>+ Add component</button>

      <div className="preview" style={{ marginTop: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Cost {fmt(cost)} /{per}</span>
          <span><b>Sell {fmt(sell)} /{per}</b> · {Math.round(draft.marginRate * 100)}%</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={save}>Save rate</button>
        <button className="btn secondary" onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </div>
  );
}
