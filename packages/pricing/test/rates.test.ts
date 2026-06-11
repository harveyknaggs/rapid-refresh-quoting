import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, volume, applyWaste, loadsFromVolume, barkChipCost, cartage } from '../src/rates.ts';

test('cartage: >2 m³ = flat $75.65 delivery; ≤2 m³ = pickup (1 hr + $15 diesel)', () => {
  const big = cartage(6);
  assert.equal(big.mode, 'delivery');
  if (big.mode === 'delivery') assert.equal(big.deliveryCents, 7565); // flat, not per m³
  assert.equal(cartage(3).mode, 'delivery');                          // 3 m³ → delivery
  const small = cartage(2);
  assert.equal(small.mode, 'pickup');                                 // exactly 2 m³ → pickup
  if (small.mode === 'pickup') { assert.equal(small.labourHours, 1); assert.equal(small.dieselCents, 1500); }
});

test('measurement helpers', () => {
  assert.equal(area(4, 3), 12);                       // 4m × 3m = 12 m²
  assert.ok(Math.abs(volume(12, 0.05) - 0.6) < 1e-9); // 12 m² × 50mm = 0.6 m³ (float-safe)
  assert.ok(Math.abs(applyWaste(10, 0.10) - 11) < 1e-9); // +10% contingency
});

test('bark loads: trailer holds 2 m³ (6 scoops)', () => {
  assert.equal(loadsFromVolume(2, 2), 1);
  assert.equal(loadsFromVolume(3, 2), 2);
  assert.equal(loadsFromVolume(0.5, 2), 1);
});

test('AP20/aggregate loads: trailer holds 2 scoops ≈ 0.667 m³', () => {
  assert.equal(loadsFromVolume(3, 2 / 3), 5);   // 3 ÷ 0.667 = 4.5 → 5 loads
  assert.equal(loadsFromVolume(2 / 3, 2 / 3), 1);
});

test('bark/chip 2 m³ = base + 7% levy (on base) + 1 load delivery', () => {
  const r = barkChipCost(2);
  assert.equal(r.baseCents, 16900);   // $84.50 × 2 = $169.00
  assert.equal(r.levyCents, 1183);    // 7% of $169.00 = $11.83
  assert.equal(r.loads, 1);
  assert.equal(r.deliveryCents, 6000);// $60 × 1 load
  assert.equal(r.costCents, 24083);   // $240.83 all-in
});

test('bark/chip 3 m³ = 2 loads delivery', () => {
  const r = barkChipCost(3);
  assert.equal(r.loads, 2);
  assert.equal(r.costCents, 39125);   // $253.50×1.07=$271.245 + $120 = $391.245 → $391.25
});
