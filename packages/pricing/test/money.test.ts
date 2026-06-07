import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripGst, gstOf, inclOf, rawSellFromCost, roundToDollar, marginOf,
} from '../src/money.ts';

test('GST strip: $115 incl → $100.00 ex', () => {
  assert.equal(stripGst(11500), 10000);
});

test('GST strip is exact on an awkward supplier price ($49.99 incl)', () => {
  assert.equal(stripGst(4999), 4347); // $49.99 / 1.15 = $43.4696 → $43.47
});

test('GST component on $100 ex = $15, inclusive = $115', () => {
  assert.equal(gstOf(10000), 1500);
  assert.equal(inclOf(10000), 11500);
});

test('TRUE margin 40%: $600 cost → $1000 sell (cost ÷ 0.60)', () => {
  assert.equal(rawSellFromCost(60000, 0.40), 100000);
});

test('TRUE margin 35% (÷0.65) and 30% (÷0.70) raw values', () => {
  assert.equal(Math.round(rawSellFromCost(60000, 0.35)), 92308); // $923.08
  assert.equal(Math.round(rawSellFromCost(60000, 0.30)), 85714); // $857.14
});

test('line rounds to the nearest dollar', () => {
  assert.equal(roundToDollar(92308), 92300); // $923.08 → $923
  assert.equal(roundToDollar(85714), 85700); // $857.14 → $857
  assert.equal(roundToDollar(49333), 49300); // $493.33 → $493
  assert.equal(roundToDollar(49350), 49400); // $493.50 → $494 (half up)
});

test('marginOf inverts cleanly', () => {
  assert.ok(Math.abs(marginOf(60000, 100000) - 0.40) < 1e-9);
});
