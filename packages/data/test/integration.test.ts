import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryQuoteRepository } from '../src/index.ts';
import { ulid, priceQuoteVersion } from '../../domain/src/index.ts';

test('end-to-end: build → price → accept → duplicate → actuals', async () => {
  const repo = new InMemoryQuoteRepository();
  const { quote, version } = await repo.createQuote({
    clientId: ulid(), propertyId: ulid(), clientName: 'Ger Murphy', address: '5 Beach Rd',
  });

  // Build a scope: labour (margin on $37) + turf (fixed sell $190/m²)
  version.scopes.push({
    id: ulid(), title: 'Front garden', description: 'Lay turf + crew', order: 0,
    lines: [
      { id: ulid(), type: 'labour', description: 'Crew', unit: 'hour', quantity: 8, costRateCents: 3700, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 0 },
      { id: ulid(), type: 'material', description: 'Artificial turf', unit: 'm2', quantity: 10, costRateCents: 5600, costRateGstInclusive: false, pricing: { method: 'charge', sellRateCents: 19000 }, rateCardItemId: null, order: 1 },
    ],
  });
  await repo.saveVersion(version);

  const reloaded = await repo.getCurrentVersion(quote.id);
  const t = priceQuoteVersion(reloaded!).total;
  assert.equal(t.costCents, 29600 + 59920);          // $895.20 (turf material +7% levy: $560→$599.20)
  assert.equal(t.sellCents, 49300 + 190000);         // $2393.00 ex GST (charge sell unaffected by levy)
  assert.equal(t.gstCents, 35895);                   // 15%
  assert.equal(t.grandTotalInclCents, 275195);       // $2751.95 incl

  // Accept marks the version
  await repo.setStatus(reloaded!.id, 'accepted');
  assert.equal((await repo.getQuote(quote.id))!.acceptedVersionId, reloaded!.id);

  // Duplicate as template → fresh draft quote
  const dup = await repo.duplicateAsTemplate(quote.id, { clientId: ulid(), propertyId: ulid(), clientName: 'New Client', address: '9 New Rd' });
  const dupV = await repo.getCurrentVersion(dup.quote.id);
  assert.equal(priceQuoteVersion(dupV!).total.sellCents, 239300); // same scopes, recomputed identically

  // Actuals: real cost came in under quote
  await repo.addActual({ quoteId: quote.id, scopeId: null, lineItemId: null, description: 'Materials', amountCents: 90000 });
  const actuals = await repo.listActuals(quote.id);
  assert.equal(actuals.reduce((s, a) => s + a.amountCents, 0), 90000);
});
