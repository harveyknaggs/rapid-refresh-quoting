import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ulid, deriveTitle, seedRateCard, priceQuoteVersion, priceScope, FUEL_LEVY } from '../src/index.ts';

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
