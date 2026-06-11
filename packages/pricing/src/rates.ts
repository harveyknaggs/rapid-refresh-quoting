// rates.ts — measurement helpers + rate-card-specific cost math (bark/chip levy & delivery).
// Pure. The user thinks in measurements; these turn measurements into volumes/loads/cost.

import { roundCents, type Cents } from './money.ts';

/** L × W → m². */
export const area = (lengthM: number, widthM: number): number => lengthM * widthM;

/** m² × depth → m³. */
export const volume = (areaM2: number, depthM: number): number => areaM2 * depthM;

/** Optional waste/contingency factor (e.g. 0.05–0.10) on material volumes. */
export const applyWaste = (qty: number, wastePct: number): number => qty * (1 + wastePct);

/** Delivery loads from a volume given trailer capacity (rounded up — you pay per load). */
export const loadsFromVolume = (m3: number, capacityM3: number): number =>
  Math.ceil(m3 / capacityM3);

export interface BarkOpts {
  baseRateCents?: number;        // $/m³ base       (default $84.50)
  fuelLevy?: number;             // on base only    (default 7%)
  deliveryPerLoadCents?: number; // per load        (default $60)
  capacityM3?: number;           // trailer capacity (default 2 m³ = 6 scoops)
}
export interface BarkResult {
  costCents: Cents;
  loads: number;
  baseCents: Cents;
  levyCents: Cents;
  deliveryCents: Cents;
}

// ---- Cartage (per bulk material/product) ----
// Over 2 m³ → supplier delivers at a FLAT fee (one per product, not per m³).
// 2 m³ or under → we pick it up: allow 1 hr labour + diesel.
export const DELIVERY_THRESHOLD_M3 = 2;
export const DELIVERY_FLAT_CENTS = 7565;   // $75.65 flat per product over 2 m³
export const PICKUP_LABOUR_HOURS = 1;      // 1 hr to go and collect
export const PICKUP_DIESEL_CENTS = 1500;   // $15 diesel

export type Cartage =
  | { mode: 'delivery'; deliveryCents: Cents }
  | { mode: 'pickup'; labourHours: number; dieselCents: Cents };

/** Cartage for ONE product given its volume. Each product is carted separately. */
export const cartage = (
  m3: number,
  opts: { deliveryCents?: number; dieselCents?: number } = {},
): Cartage =>
  m3 > DELIVERY_THRESHOLD_M3
    ? { mode: 'delivery', deliveryCents: opts.deliveryCents ?? DELIVERY_FLAT_CENTS }
    : { mode: 'pickup', labourHours: PICKUP_LABOUR_HOURS, dieselCents: opts.dieselCents ?? PICKUP_DIESEL_CENTS };

/**
 * Bark/chip cost: base + 7% fuel levy (on base, BEFORE delivery) + $60/load delivery.
 * Trailer = 2 m³ (6 scoops). Aggregate/AP20 is heavier — pass capacityM3 ≈ 0.667 (2 scoops).
 */
export const barkChipCost = (m3: number, opts: BarkOpts = {}): BarkResult => {
  const baseRateCents = opts.baseRateCents ?? 8450;
  const fuelLevy = opts.fuelLevy ?? 0.07;
  const deliveryPerLoadCents = opts.deliveryPerLoadCents ?? 6000;
  const capacityM3 = opts.capacityM3 ?? 2;

  const base = baseRateCents * m3;
  const levy = base * fuelLevy;
  const loads = loadsFromVolume(m3, capacityM3);
  const deliveryCents = loads * deliveryPerLoadCents;
  const costCents = roundCents(base + levy + deliveryCents);

  return { costCents, loads, baseCents: roundCents(base), levyCents: roundCents(levy), deliveryCents };
};
