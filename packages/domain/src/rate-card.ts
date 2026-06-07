// rate-card.ts — single source of truth seed, as EDITABLE defaults.
// Values in cents. Assumptions are flagged inline (turf sell $190, bark GST treatment, capacities).

import type { RateCardItem } from './types.ts';
import { ulid } from './ids.ts';

const item = (r: Omit<RateCardItem, 'id'>): RateCardItem => ({ id: ulid(), ...r });

export const seedRateCard = (): RateCardItem[] => [
  item({
    key: 'bark_chip', label: 'Bark / chip', unit: 'm3', type: 'material',
    costRateCents: 8450, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    modifiers: { fuelLevy: 0.07, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: 'Cost via barkChipCost(): base + 7% levy + $60/load (2 m³ = 6 scoops/trailer). FLAG: confirm base is GST-excl.',
    active: true,
  }),
  item({
    key: 'labour', label: 'Labour', unit: 'hour', type: 'labour',
    costRateCents: 3700, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    notes: 'Margin on the $37 cost → $61.67/hr at 40%. Never margins the $65.',
    active: true,
  }),
  item({
    key: 'deck_stain', label: 'Deck staining', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 3200,
    defaultPricing: { method: 'charge', sellRateCents: 3200 }, notes: '$32/m² all-in, no margin.', active: true,
  }),
  item({
    key: 'turf', label: 'Artificial turf', unit: 'm2', type: 'material',
    costRateCents: 5600, costRateGstInclusive: false, sellRateCents: 19000,
    defaultPricing: { method: 'charge', sellRateCents: 19000 },
    notes: 'Cost $56/m², sell $190/m² (range $190–200 — FLAG: default $190).', active: true,
  }),
  item({
    key: 'ap20', label: 'AP20 basecourse', unit: 'm3', type: 'material',
    costRateCents: 9000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    modifiers: { deliveryPerLoadCents: 6000, capacityM3: 2 / 3 },
    notes: '$90/m³. Heavier — 2 scoops/trailer ≈ 0.667 m³/load.', active: true,
  }),
  item({ key: 'boxing_timber', label: 'Boxing timber', unit: 'lineal_m', type: 'material',
    costRateCents: 1200, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, active: true }),
  item({ key: 'corten_boxing', label: 'Corten steel boxing', unit: 'lineal_m', type: 'material',
    costRateCents: 4500, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, active: true }),
  item({ key: 'pavers_450x900', label: '450×900 pavers', unit: 'each', type: 'material',
    costRateCents: 3717, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, notes: 'Priced per lineal metre of path.', active: true }),
  item({ key: 'lawn', label: 'Lawn (turf)', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 6500,
    defaultPricing: { method: 'charge', sellRateCents: 6500 }, notes: '$65/m² sell; prep $60/m² separate.', active: true }),
  item({ key: 'lawn_prep', label: 'Lawn prep', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 6000,
    defaultPricing: { method: 'charge', sellRateCents: 6000 }, active: true }),
  item({ key: 'hydroseed', label: 'Hydroseed', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 3250,
    defaultPricing: { method: 'charge', sellRateCents: 3250 }, active: true }),
  item({ key: 'stone_supply', label: 'Stone supply', unit: 'm3', type: 'material',
    costRateCents: 16000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, notes: 'Handling 1 hr/m³ (add a labour line).', active: true }),
];
