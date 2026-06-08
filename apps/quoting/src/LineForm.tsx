import { useMemo, useState } from 'react';
import {
  ulid, type LineItem, type LineType, type Unit, type RateCardItem,
} from '@rapid-refresh/domain';
import { computeLine, barkChipCost, isMarginOutsideBand } from '@rapid-refresh/pricing';
import { fmt, pct, dollarsToCents, num } from './format.ts';

const UNITS: Unit[] = ['m2', 'm3', 'lineal_m', 'each', 'hour', 'load', 'flat'];
const UNIT_LABEL: Record<Unit, string> = {
  m2: 'm²', m3: 'm³', lineal_m: 'lineal m', each: 'each', hour: 'hour', load: 'load', flat: 'flat',
};

type Method = 'margin' | 'passthrough' | 'charge';
type Measure = 'direct' | 'lw' | 'lwh';

export function LineForm({ rateCard, onAdd, onCancel }: {
  rateCard: RateCardItem[];
  onAdd: (line: LineItem) => void;
  onCancel: () => void;
}) {
  const [rateKey, setRateKey] = useState('');
  const [type, setType] = useState<LineType>('material');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<Unit>('m2');
  const [measure, setMeasure] = useState<Measure>('direct');
  const [directQty, setDirectQty] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [waste, setWaste] = useState(false);
  const [wastePct, setWastePct] = useState('10');
  const [costDollars, setCostDollars] = useState('');
  const [gstIncl, setGstIncl] = useState(false);
  const [method, setMethod] = useState<Method>('margin');
  const [marginRate, setMarginRate] = useState('0.40');
  const [sellDollars, setSellDollars] = useState('');

  const selected = rateCard.find((r) => r.id === rateKey);

  const applyRateItem = (id: string) => {
    setRateKey(id);
    const it = rateCard.find((r) => r.id === id);
    if (!it) return;
    setType(it.type);
    setUnit(it.unit);
    setDescription(it.label);
    setGstIncl(it.costRateGstInclusive);
    if (it.costRateCents != null) setCostDollars((it.costRateCents / 100).toString());
    if (it.defaultPricing.method === 'margin') { setMethod('margin'); setMarginRate(String(it.defaultPricing.rate)); }
    else if (it.defaultPricing.method === 'charge') { setMethod('charge'); setSellDollars((it.defaultPricing.sellRateCents / 100).toString()); }
    else setMethod('passthrough');
  };

  const rawQty = measure === 'lw' ? num(length) * num(width)
    : measure === 'lwh' ? num(length) * num(width) * num(depth)
    : num(directQty);
  const quantity = waste ? rawQty * (1 + num(wastePct) / 100) : rawQty;

  const built = useMemo((): { line: LineItem; note: string } => {
    let costRateCents = dollarsToCents(costDollars);
    let note = '';
    if (selected?.modifiers && (selected.modifiers.fuelLevy || selected.modifiers.deliveryPerLoadCents) && unit === 'm3' && quantity > 0) {
      const bark = barkChipCost(quantity, {
        baseRateCents: costRateCents,
        fuelLevy: selected.modifiers.fuelLevy ?? 0,
        deliveryPerLoadCents: selected.modifiers.deliveryPerLoadCents ?? 0,
        capacityM3: selected.modifiers.capacityM3 ?? 1e9,
      });
      costRateCents = Math.round(bark.costCents / quantity);
      const levyPct = (selected.modifiers.fuelLevy ?? 0) * 100;
      note = `incl ${levyPct ? levyPct + '% levy + ' : ''}${fmt(bark.deliveryCents)} delivery (${bark.loads} load${bark.loads > 1 ? 's' : ''})`;
    }
    const pricing = method === 'margin'
      ? { method: 'margin' as const, rate: num(marginRate) }
      : method === 'charge'
        ? { method: 'charge' as const, sellRateCents: dollarsToCents(sellDollars) }
        : { method: 'passthrough' as const };
    const line: LineItem = {
      id: ulid(), type, description: description || selected?.label || '', unit,
      quantity, costRateCents, costRateGstInclusive: gstIncl, pricing,
      rateCardItemId: selected?.id ?? null, order: 0,
    };
    return { line, note };
  }, [costDollars, selected, unit, quantity, method, marginRate, sellDollars, type, description, gstIncl]);

  const preview = computeLine({
    quantity: built.line.quantity, costRateCents: built.line.costRateCents,
    costRateGstInclusive: built.line.costRateGstInclusive, pricing: built.line.pricing,
  });

  const issues: string[] = [];
  if (quantity <= 0) issues.push('Enter a quantity / measurement.');
  if (type === 'labour' && quantity <= 0) issues.push('Labour needs hours.');
  if (method === 'margin' && isMarginOutsideBand(num(marginRate))) issues.push(`Margin ${pct(num(marginRate))} is outside the 35–45% band.`);
  if (method === 'charge' && dollarsToCents(sellDollars) <= 0) issues.push('Enter a sell rate.');

  return (
    <div className="card" style={{ background: '#f8fafc' }}>
      <h3>Add line</h3>

      <label className="field">
        <span>From rate card (optional — prefills below)</span>
        <select className="input" value={rateKey} onChange={(e) => applyRateItem(e.target.value)}>
          <option value="">— manual entry —</option>
          {rateCard.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>

      <div className="grid2">
        <label className="field"><span>Type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as LineType)}>
            <option value="material">Material</option><option value="labour">Labour</option><option value="other">Other</option>
          </select>
        </label>
        <label className="field"><span>Unit</span>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        </label>
      </div>

      <label className="field"><span>Description</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Bark — garden beds" />
      </label>

      <label className="field"><span>Measure by</span>
        <select className="input" value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
          <option value="direct">Direct quantity</option>
          <option value="lw">L × W → m²</option>
          <option value="lwh">L × W × depth → m³</option>
        </select>
      </label>

      {measure === 'direct' && (
        <label className="field"><span>Quantity ({UNIT_LABEL[unit]})</span>
          <input className="input" inputMode="decimal" value={directQty} onChange={(e) => setDirectQty(e.target.value)} />
        </label>
      )}
      {measure !== 'direct' && (
        <div className={measure === 'lwh' ? 'grid3' : 'grid2'}>
          <label className="field"><span>Length (m)</span><input className="input" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} /></label>
          <label className="field"><span>Width (m)</span><input className="input" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} /></label>
          {measure === 'lwh' && <label className="field"><span>Depth (m)</span><input className="input" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} /></label>}
        </div>
      )}

      <div className="row tight">
        <label className="row tight"><input type="checkbox" checked={waste} onChange={(e) => setWaste(e.target.checked)} /> Waste/contingency</label>
        {waste && <input className="input" style={{ width: 70 }} inputMode="decimal" value={wastePct} onChange={(e) => setWastePct(e.target.value)} />}
        {waste && <span className="muted small">%</span>}
        <span className="muted small">→ {quantity.toFixed(2)} {UNIT_LABEL[unit]}</span>
      </div>

      <div className="grid2" style={{ marginTop: 10 }}>
        <label className="field"><span>Pricing</span>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            <option value="margin">Margin on cost</option>
            <option value="charge">Fixed sell rate</option>
            <option value="passthrough">Pass-through (at cost)</option>
          </select>
        </label>
        {method === 'margin' && (
          <label className="field"><span>Margin</span>
            <select className="input" value={marginRate} onChange={(e) => setMarginRate(e.target.value)}>
              <option value="0.40">40% standard</option>
              <option value="0.35">35% plant supply</option>
              <option value="0.30">30% some materials</option>
              <option value="0.45">45%</option>
            </select>
          </label>
        )}
        {method === 'charge' && (
          <label className="field"><span>Sell rate $ / {UNIT_LABEL[unit]}</span>
            <input className="input" inputMode="decimal" value={sellDollars} onChange={(e) => setSellDollars(e.target.value)} />
          </label>
        )}
      </div>

      {method !== 'charge' && (
        <div className="row tight">
          <label className="field" style={{ flex: 1 }}><span>Cost rate $ / {UNIT_LABEL[unit]}</span>
            <input className="input" inputMode="decimal" value={costDollars} onChange={(e) => setCostDollars(e.target.value)} />
          </label>
          <label className="row tight" style={{ marginTop: 14 }}><input type="checkbox" checked={gstIncl} onChange={(e) => setGstIncl(e.target.checked)} /> GST-incl (÷1.15)</label>
        </div>
      )}

      <div className="preview">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted small">Cost {fmt(preview.costCents)}{built.note ? ` · ${built.note}` : ''}</span>
          <span><b>Sell {fmt(preview.sellCents)}</b> · {pct(preview.effectiveMargin)}</span>
        </div>
      </div>
      {issues.map((i) => <div className="issue" key={i}>⚠ {i}</div>)}

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={issues.length > 0} onClick={() => onAdd({ ...built.line })}>Add line</button>
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
