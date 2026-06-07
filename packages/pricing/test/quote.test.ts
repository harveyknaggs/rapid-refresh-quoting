import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLine, computeScope, computeQuote, sensitivity, reconcile, validateLine,
} from '../src/quote.ts';

test('LABOUR: margin applies to the $37 cost, NOT to $65', () => {
  const l = computeLine({ quantity: 8, costRateCents: 3700, pricing: { method: 'margin', rate: 0.40 } });
  assert.equal(l.costCents, 29600);  // 8 hrs × $37
  assert.equal(l.sellCents, 49300);  // $296 ÷ 0.60 = $493.33 → $493  (≈ $61.67/hr)
});

test('material entered GST-inclusive: stripped to true cost, then margined', () => {
  // $115/unit incl, qty 2 → true cost $200 → 40% → $333.33 → $333
  const l = computeLine({ quantity: 2, costRateCents: 11500, costRateGstInclusive: true, pricing: { method: 'margin', rate: 0.40 } });
  assert.equal(l.costCents, 20000);
  assert.equal(l.sellCents, 33300);
});

test('charge line (turf sell $190/m²): no margin stacked on the sell rate', () => {
  const l = computeLine({ quantity: 10, costRateCents: 5600, pricing: { method: 'charge', sellRateCents: 19000 } });
  assert.equal(l.costCents, 56000);   // $56 × 10
  assert.equal(l.sellCents, 190000);  // $190 × 10
});

test('passthrough sells at cost', () => {
  const l = computeLine({ quantity: 1, costRateCents: 12345, pricing: { method: 'passthrough' } });
  assert.equal(l.sellCents, 12300);   // $123.45 → $123
});

test('scope total = sum of ROUNDED line sells (not recomputed from combined cost)', () => {
  const a = computeLine({ quantity: 8, costRateCents: 3700, pricing: { method: 'margin', rate: 0.40 } }); // $493
  const b = computeLine({ quantity: 1, costRateCents: 10000, pricing: { method: 'margin', rate: 0.40 } }); // $167
  const s = computeScope([a, b]);
  assert.equal(s.costCents, 29600 + 10000);
  assert.equal(s.sellCents, 49300 + 16700);
});

test('quote rollup: scopes summed, GST as separate line, blended margin', () => {
  const scope = computeScope([computeLine({ quantity: 1, costRateCents: 60000, pricing: { method: 'margin', rate: 0.40 } })]);
  const q = computeQuote([scope]);
  assert.equal(q.sellCents, 100000);          // $1000 ex-GST
  assert.equal(q.gstCents, 15000);            // $150 GST line
  assert.equal(q.grandTotalInclCents, 115000);// $1150 incl
  assert.ok(Math.abs(q.blendedMargin - 0.40) < 1e-9);
});

test('sensitivity at 35 / 40 / 45% on a $600 cost', () => {
  const rows = sensitivity(60000);
  assert.deepEqual(rows.map((r) => r.sellCents), [92300, 100000, 109100]);
  // $923 / $1000 / $1091
});

test('track-actuals: cost blew out → actual margin + sell to recover target', () => {
  const r = reconcile(100000, 70000, 0.40); // quoted $1000, real cost $700, target 40%
  assert.ok(Math.abs(r.actualMargin - 0.30) < 1e-9);   // (1000−700)/1000 = 30%
  assert.equal(r.onTarget, false);
  assert.equal(r.sellToRecoverTargetCents, 116700);    // $700 ÷ 0.60 = $1166.67 → $1167
  assert.equal(r.shortfallVsQuotedCents, 16700);       // $167 under-quoted
});

test('validation flags labour with no hours and out-of-band margin', () => {
  assert.deepEqual(
    validateLine({ type: 'labour', quantity: 0, costRateCents: 3700, pricing: { method: 'margin', rate: 0.40 } }).map((i) => i.code),
    ['labour-no-hours'],
  );
  assert.deepEqual(
    validateLine({ type: 'material', quantity: 1, costRateCents: 5000, pricing: { method: 'margin', rate: 0.50 } }).map((i) => i.code),
    ['margin-out-of-band'],
  );
});
