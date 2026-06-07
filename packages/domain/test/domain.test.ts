import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ulid, deriveTitle, seedRateCard, priceQuoteVersion } from '../src/index.ts';

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
  assert.equal(scopes[0].sellCents, 49300 + 100000);   // $493 labour + $1000 timber
  assert.equal(total.sellCents, 149300);
  assert.equal(total.gstCents, 22395);                 // 15% of $1493.00
  assert.equal(total.grandTotalInclCents, 171695);     // $1716.95 incl
});
