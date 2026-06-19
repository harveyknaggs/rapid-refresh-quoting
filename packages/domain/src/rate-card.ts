// rate-card.ts — single source of truth seed, as EDITABLE defaults. Values in CENTS.
// Backed by real data: costs from CLS wholesale (GST-EXCLUSIVE) + sell rates from past quotes.
// See repo-root RATES.md (rate book) and suppliers-CLS.md (supplier costs) for sources/build-ups.
// Fuel levy: +7% on ALL materials (applied by the pricing engine; modifiers.fuelLevy documents it).

import type { RateCardItem } from './types.ts';
import { ulid } from './ids.ts';

const item = (r: Omit<RateCardItem, 'id'>): RateCardItem => ({ id: ulid(), ...r });
const LEVY = 0.07; // fuel levy on materials

export const seedRateCard = (): RateCardItem[] => [
  // ---- Labour & machine hire ----
  item({
    key: 'labour', label: 'Labour', unit: 'hour', type: 'labour',
    costRateCents: 3700, costRateGstInclusive: false, sellRateCents: 6500,
    defaultPricing: { method: 'charge', sellRateCents: 6500 },
    notes: 'Cost $37/hr, charged at $65/hr → ~43% margin.', active: true,
  }),
  item({ key: 'digger_operator', label: 'Digger + truck + operator', unit: 'hour', type: 'other',
    costRateCents: 15000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, notes: 'Gavin $150/hr cost. Affordable Hire digger $45/hr + $165 tipper.', active: true }),

  // ---- Bark, mulch & bulk (CLS ex-GST; +7% levy + delivery per load) ----
  item({
    key: 'bark_chip', label: 'Black Bark / Premium Brown Chip', unit: 'm3', type: 'material',
    costRateCents: 9100, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    modifiers: { fuelLevy: LEVY, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: 'CLS $91/m³. +7% levy + $60/load (2 m³/trailer).', active: true,
  }),
  item({ key: 'super_cover_mulch', label: 'Super Cover Mulch / Mill Chip', unit: 'm3', type: 'material',
    costRateCents: 5900, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: 'CLS $59/m³.', active: true }),
  item({ key: 'arbor_mulch', label: 'Arbor Mulch', unit: 'm3', type: 'material',
    costRateCents: 2600, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: 'CLS $26/m³ (Arbor Chip/Scree $39). Move/spread ~$35/m³ labour.', active: true }),
  item({ key: 'drainage_chip_19', label: '19mm drainage chip', unit: 'm3', type: 'material',
    costRateCents: 10200, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.30 }, modifiers: { fuelLevy: LEVY, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: '$102/m³ (76 Tuahiwi). Bulk ~20–30% margin; +10% wastage on volume.', active: true }),
  item({ key: 'stone_supply', label: 'Stone (white / Amuri)', unit: 'm3', type: 'material',
    costRateCents: 16000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY, deliveryPerLoadCents: 6000, capacityM3: 2 },
    notes: '$160/m³. Handling ~1 hr/m³ (add a labour line).', active: true }),
  item({
    key: 'ap20', label: 'AP20 / GAP20 basecourse', unit: 'm3', type: 'material',
    costRateCents: 4480, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Frews',
    suppliers: [{ supplier: 'Frews', costRateCents: 4480, costRateGstInclusive: false, notes: '$44.80/m³ ex-GST (Belfast/Wasteport)' }],
    modifiers: { deliveryPerLoadCents: 6000, capacityM3: 2 / 3 },
    notes: 'Frews $44.80/m³ (AP40 $42.50, AP65 $45.60). Quarry → NO fuel levy. Fulton Hogan similar; CLS = retail −10%. Heavier: ~0.667 m³/load.', active: true,
  }),
  item({
    key: 'crusher_dust', label: 'Crusher dust (AP5)', unit: 'm3', type: 'material',
    costRateCents: 7200, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Frews',
    suppliers: [{ supplier: 'Frews', costRateCents: 7200, costRateGstInclusive: false }],
    modifiers: { deliveryPerLoadCents: 6000, capacityM3: 2 / 3 },
    notes: 'Frews AP5 $72/m³ ex-GST. Quarry → NO fuel levy. Garden Box AP5 $38.35 (yard → levied; confirm per m³ vs scoop).', active: true,
  }),

  // ---- Soils & compost (CLS ex-GST, /m³) ----
  item({ key: 'screened_soil', label: 'Screened soil', unit: 'm3', type: 'material',
    costRateCents: 3950, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY }, notes: 'CLS $39.50/m³ (unscreened $20.50).', active: true }),
  item({ key: 'garden_soil_blend', label: 'Garden soil blend', unit: 'm3', type: 'material',
    costRateCents: 5300, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY }, notes: 'CLS $53/m³.', active: true }),
  item({ key: 'lawn_construction_mix', label: 'Lawn construction mix', unit: 'm3', type: 'material',
    costRateCents: 6800, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, modifiers: { fuelLevy: LEVY }, notes: 'CLS $68/m³ (top dressing $78).', active: true }),

  // ---- Garden bed items ----
  item({ key: 'weedmat', label: 'Weedmat (supply)', unit: 'm2', type: 'material',
    costRateCents: 55, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    notes: 'CLS mat ~$0.55/m² + pins ~$0.07–0.11 ea. Real cost is the lay labour — add a labour line.', active: true }),
  item({ key: 'plant_supply', label: 'Plants (supply)', unit: 'each', type: 'material',
    costRateCents: 1000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    notes: 'Range $7.50–15/plant (feature tree ~$85). Plant labour ~10 min/plant, ~30 min/tree.', active: true }),

  // ---- Edging / hard landscaping ----
  item({ key: 'boxing_timber', label: 'Timber edging (75×50 H4 + pegs)', unit: 'lineal_m', type: 'material',
    costRateCents: 1200, costRateGstInclusive: false, sellRateCents: 3333,
    defaultPricing: { method: 'charge', sellRateCents: 3333 },
    notes: 'All-in sell $33.33/lm (incl install); material ~$12/lm. Range $30–35/lm.', active: true }),
  item({ key: 'corten_boxing', label: 'Corten steel boxing', unit: 'lineal_m', type: 'material',
    costRateCents: 4500, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, active: true }),
  // Paving prep — sold at a flat $65/m² (dig-out + AP20 base). Pavers + lay labour are separate lines.
  item({ key: 'paving_prep', label: 'Paving prep (dig-out + AP20 base)', unit: 'm2', type: 'other',
    costRateCents: 2600, costRateGstInclusive: false, sellRateCents: 6500,
    defaultPricing: { method: 'charge', sellRateCents: 6500 },
    notes: '$65/m² sell = dig out 100mm + 100mm AP20 compacted. Approx cost/m²: AP20 0.1m³ (~$4.48) + 0.1m³ soil dumped (hardfill) + labour dig-out 2hr/m³ & bring-in 1hr/m³. Add pavers (cost+margin) + lay labour separately.', active: true }),

  // Pavers — Garden Box listed prices stripped to ex-GST (retail ÷1.15). Actual trade ~a few % lower.
  item({ key: 'paver_400', label: 'Paver 400×400 (Feinwerk)', unit: 'each', type: 'material',
    costRateCents: 1087, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Garden Box',
    suppliers: [{ supplier: 'Garden Box', costRateCents: 1087, costRateGstInclusive: false, notes: '$12.50 retail incl → ex-GST' }],
    notes: 'Garden Box Charcoal/Carbon, ex-GST.', active: true }),
  item({ key: 'paver_500', label: 'Paver 500×500 (Feinwerk)', unit: 'each', type: 'material',
    costRateCents: 1609, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Garden Box',
    suppliers: [{ supplier: 'Garden Box', costRateCents: 1609, costRateGstInclusive: false, notes: '$18.50 retail incl → ex-GST; Roy paid ~$15.28' }],
    notes: 'Garden Box Charcoal/Carbon, ex-GST.', active: true }),
  item({ key: 'paver_600', label: 'Paver 600×600 (Feinwerk)', unit: 'each', type: 'material',
    costRateCents: 2130, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Garden Box',
    suppliers: [{ supplier: 'Garden Box', costRateCents: 2130, costRateGstInclusive: false, notes: '$24.50 retail incl → ex-GST' }],
    notes: 'Garden Box Charcoal/Carbon, ex-GST.', active: true }),
  item({ key: 'pavers', label: 'Pavers (other / custom)', unit: 'each', type: 'material',
    costRateCents: 3717, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, defaultSupplier: 'Garden Box',
    notes: 'Garden Box range incl GST: 600×300 rect $17.50, 900×450 rect $45, Bluestone steppers $40–54.50. + mortar $150–200/job.', active: true }),
  item({ key: 'retaining_wall', label: 'Retaining wall (supply & install)', unit: 'lineal_m', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 28000,
    defaultPricing: { method: 'charge', sellRateCents: 28000 }, notes: 'All-in $280/lm to ~1.2 m. H5 post ~$18/lm.', active: true }),

  // ---- Lawn (fixed sell rates; cost build-up noted) ----
  item({ key: 'ready_lawn', label: 'Ready lawn (supply + lay)', unit: 'm2', type: 'other',
    costRateCents: 913, costRateGstInclusive: false, sellRateCents: 6000,
    defaultPricing: { method: 'charge', sellRateCents: 6000 },
    notes: 'Sell ~$45–65/m² (flat→hill). Cost = turf $9.13/m² + lay labour ($37/hr) + $250 delivery (add those lines).', active: true }),
  item({ key: 'hydroseed', label: 'Hydroseed', unit: 'm2', type: 'other',
    costRateCents: 971, costRateGstInclusive: false, sellRateCents: 2800,
    defaultPricing: { method: 'charge', sellRateCents: 2800 },
    notes: 'Subbed to Hydroturf $9.71/m² cost; sell $25–30/m².', active: true }),
  item({ key: 'lawn_prep', label: 'Lawn prep / scarify', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 6000,
    defaultPricing: { method: 'charge', sellRateCents: 6000 }, notes: 'Or price as labour $37/hr cost.', active: true }),
  item({ key: 'turf', label: 'Artificial turf', unit: 'm2', type: 'material',
    costRateCents: 5600, costRateGstInclusive: false, sellRateCents: 19000,
    defaultPricing: { method: 'charge', sellRateCents: 19000 }, notes: 'Cost $56/m², sell $190/m² (FLAG: default).', active: true }),

  // ---- Exterior cleaning ----
  item({ key: 'deck_stain', label: 'Deck staining', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 3200,
    defaultPricing: { method: 'charge', sellRateCents: 3200 }, notes: '$32/m² sell (confirm). Oil ~5 m²/litre over 2 coats.', active: true }),
  item({ key: 'waterblast', label: 'Waterblast', unit: 'm2', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 450,
    defaultPricing: { method: 'charge', sellRateCents: 450 }, notes: '$4.50/m²; or flat ~$400 min.', active: true }),
  item({ key: 'house_wash', label: 'House / soft wash', unit: 'flat', type: 'other',
    costRateCents: null, costRateGstInclusive: false, sellRateCents: 24000,
    defaultPricing: { method: 'charge', sellRateCents: 24000 }, notes: 'House wash ~$240; +gutters ~$560–600.', active: true }),
  item({ key: 'gutter_clean', label: 'Gutter clean', unit: 'flat', type: 'other',
    costRateCents: 17500, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, notes: 'Cost $150–200; roof+gutters ~$950.', active: true }),

  // ---- Site costs ----
  item({ key: 'delivery', label: 'Delivery (per product, over 2 m³)', unit: 'flat', type: 'other',
    costRateCents: 7565, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    notes: 'Flat $75.65 per product when its volume > 2 m³ (one per product, NOT per m³). ≤2 m³ → pickup (1 hr labour + diesel).', active: true }),
  item({ key: 'pickup_diesel', label: 'Pickup diesel (≤2 m³)', unit: 'flat', type: 'other',
    costRateCents: 1500, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 },
    notes: 'When we collect (≤2 m³): add 1 hr labour + this $15 diesel.', active: true }),
  item({ key: 'dumping', label: 'Dumping / green waste', unit: 'flat', type: 'other',
    costRateCents: 15000, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.40 }, notes: 'Frews per tonne ex-GST: greenwaste $160–175, hardfill/soil $40–150, stumps $210–220, mixed C&D ~$291–297. Estimate load weight (greenwaste ~0.3–0.5 t/m³, soil/hardfill ~1.5 t/m³).', active: true }),
];
