// Custom per-unit rates: build a $/m² (or $/lm, etc.) rate from component costs + margin.
// Persisted on the device; merged into the price book so they show in the line picker.

import { ulid, type RateCardItem, type Unit } from '@rapid-refresh/domain';

const KEY = 'rr.customRates.v1';
const LEVY = 0.07;

export interface RateComponent {
  label: string;
  qty: number;            // amount per 1 unit of the rate (e.g. 0.05 m³ of bark per m²)
  unitCostCents: number;  // cost per the component's own unit (e.g. $/m³)
  levy?: boolean;         // +7% fuel levy (yard material)
}
export interface CustomRate {
  id: string;
  name: string;
  unit: Unit;
  marginRate: number;     // e.g. 0.40
  components: RateComponent[];
}

export const loadCustomRates = (): CustomRate[] => {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};
export const saveCustomRates = (rates: CustomRate[]): void => {
  try { localStorage.setItem(KEY, JSON.stringify(rates)); } catch { /* */ }
};

export const newRate = (): CustomRate => ({ id: ulid(), name: '', unit: 'm2', marginRate: 0.40, components: [] });

/** Per-unit cost in cents = Σ (qty × component unit cost × levy?). */
export const rateCostCents = (r: CustomRate): number =>
  Math.round(r.components.reduce((s, c) => s + (c.qty || 0) * (c.unitCostCents || 0) * (c.levy ? 1 + LEVY : 1), 0));

/** Per-unit sell in cents = cost / (1 − margin). */
export const rateSellCents = (r: CustomRate): number => {
  const cost = rateCostCents(r);
  const m = r.marginRate > 0 && r.marginRate < 1 ? r.marginRate : 0.40;
  return Math.round(cost / (1 - m));
};

/** Turn a custom rate into a price-book item (charge at the computed sell, cost recorded for margin). */
export const customRateToItem = (r: CustomRate): RateCardItem => {
  const sell = rateSellCents(r);
  const build = r.components.map((c) => `${c.label} ${c.qty}×$${((c.unitCostCents || 0) / 100).toFixed(2)}${c.levy ? '+levy' : ''}`).join(' · ');
  return {
    id: 'cr-' + r.id, key: 'cr_' + r.id, label: r.name || 'Custom rate', unit: r.unit, type: 'other',
    costRateCents: rateCostCents(r), costRateGstInclusive: false, sellRateCents: sell,
    defaultPricing: { method: 'charge', sellRateCents: sell },
    notes: `Custom rate — ${build || 'no components'} → ${Math.round(r.marginRate * 100)}% margin`,
    active: true,
  };
};

export const customRateItems = (): RateCardItem[] =>
  loadCustomRates().filter((r) => r.name && r.components.length).map(customRateToItem);
