import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ulid, deriveTitle, seedRateCard, priceQuoteVersion, priceScope, FUEL_LEVY,
  defaultSupplierFor, resolveSupplierCost, suppliersFor,
} from '../src/index.ts';

test('ULID: 26 chars, unique, time-sortable', () => {
  const a = ulid();
  const b = ulid();
  assert.equal(a.length, 26);
  assert.notEqual(a, b);
  assert.ok(ulid(1000) < ulid(2000)); // earlier timestamp sorts first
});

test('title format: "[Client] – [Address] – Quote"', () => {
  assert.equal(deriveTitle('Jane Doe', '12 Smith St'), 'Jane Doe – 12 Smith St – Quote');
});

test('seed rate card includes the core keys', () => {
  const keys = seedRateCard().map((i) => i.key);
  for (const k of ['bark_chip', 'labour', 'turf', 'deck_stain', 'ap20']) {
    assert.ok(keys.includes(k), `missing ${k}`);
  }
});

test('priceQuoteVersion runs every line through the pricing layer', () => {
  const version = {
    id: 'v', quoteId: 'q', version: 1, status: 'draft',
    validFrom: '', validUntil: '', terms: '', depositTerms: '', createdAt: '', updatedAt: '',
    scopes: [{
      id: 's', title: 'Deck', description: '', order: 0, lines: [
        { id: 'l1', type: 'labour', description: 'Build', unit: 'hour', quantity: 8, costRateCents: 3700, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 0 },
        { id: 'l2', type: 'material', description: 'Timber', unit: 'lineal_m', quantity: 1, costRateCents: 60000, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 1 },
      ],
    }],
  };
  const { scopes, total } = priceQuoteVersion(version);
  // Timber is a MATERIAL → +7% fuel levy: cost $600 → $642, sell $642/0.60 = $1070.
  assert.equal(scopes[0].sellCents, 49300 + 107000);   // $493 labour + $1070 timber (levied)
  assert.equal(total.sellCents, 156300);
  assert.equal(total.gstCents, 23445);                 // 15% of $1563.00
  assert.equal(total.grandTotalInclCents, 179745);     // $1797.45 incl
});

test('fuel levy: +7% on MATERIAL lines via priceScope, not on labour/other', () => {
  const scope = {
    id: 's', title: '', description: '', order: 0, lines: [
      { id: 'm', type: 'material', description: 'Bark', unit: 'm3', quantity: 1, costRateCents: 10000, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 0 },
      { id: 'l', type: 'labour', description: 'Crew', unit: 'hour', quantity: 1, costRateCents: 3700, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 1 },
    ],
  };
  assert.equal(FUEL_LEVY, 0.07);
  // material $100 → +7% = $107; labour $37 unlevied → scope cost $144.00
  assert.equal(priceScope(scope as any).costCents, 10700 + 3700);
});

test('seed labour is charged $65/hr on $37 cost (~43% margin, not 40% on cost)', () => {
  const labour = seedRateCard().find((i) => i.key === 'labour');
  assert.equal(labour?.costRateCents, 3700);
  assert.equal(labour?.defaultPricing.method, 'charge');
  if (labour?.defaultPricing.method === 'charge') assert.equal(labour.defaultPricing.sellRateCents, 6500);
});

test('multi-supplier: default mapping pavers→Garden Box, else CLS, explicit defaultSupplier wins', () => {
  assert.equal(defaultSupplierFor({ key: 'pavers', label: 'Pavers (supply)' }), 'Garden Box');
  assert.equal(defaultSupplierFor({ key: 'bark_chip', label: 'Black Bark' }), 'CLS');
  assert.equal(defaultSupplierFor({ key: 'ap20', label: 'AP20', defaultSupplier: 'Frews' }), 'Frews');
});

test('fuel levy: quarry suppliers (Frews) are exempt; yards are levied', () => {
  const scope = {
    id: 's', title: '', description: '', order: 0, lines: [
      { id: 'a', type: 'material', description: 'AP20', unit: 'm3', quantity: 1, costRateCents: 4480, costRateGstInclusive: false, supplier: 'Frews', pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 0 },
      { id: 'b', type: 'material', description: 'Bark', unit: 'm3', quantity: 1, costRateCents: 9100, costRateGstInclusive: false, supplier: 'CLS', pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 1 },
    ],
  };
  // Frews AP20 unlevied ($44.80); CLS bark +7% ($91 → $97.37) → scope cost $142.17
  assert.equal(priceScope(scope as any).costCents, 4480 + 9737);
});

test('multi-supplier: resolveSupplierCost picks chosen supplier, falls back to primary', () => {
  const item = {
    id: 'i', key: 'arbor_mulch', label: 'Arbor Mulch', unit: 'm3', type: 'material',
    costRateCents: 2600, costRateGstInclusive: false, sellRateCents: null,
    defaultPricing: { method: 'margin', rate: 0.4 }, active: true,
    suppliers: [
      { supplier: 'CLS', costRateCents: 2600, costRateGstInclusive: false },
      { supplier: 'Garden Box', costRateCents: 3100, costRateGstInclusive: false },
    ],
  } as any;
  assert.equal(resolveSupplierCost(item, 'Garden Box').costRateCents, 3100);
  assert.equal(resolveSupplierCost(item, 'CLS').costRateCents, 2600);
  // default (no supplier given) → CLS for a non-paver item
  assert.equal(resolveSupplierCost(item).supplier, 'CLS');
  // unknown supplier → falls back to primary cost
  assert.equal(resolveSupplierCost(item, 'Nope').costRateCents, 2600);
  assert.deepEqual(suppliersFor(item).sort(), ['CLS', 'Garden Box']);
});
