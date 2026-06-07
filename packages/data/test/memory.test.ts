import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryQuoteRepository } from '../src/index.ts';
import { ulid } from '../../domain/src/index.ts';

const baseInput = () => ({ clientId: ulid(), propertyId: ulid(), clientName: 'Jane Doe', address: '12 Smith St' });

test('create assigns incrementing quote numbers + a draft v1', async () => {
  const repo = new InMemoryQuoteRepository();
  const { quote, version } = await repo.createQuote(baseInput());
  assert.equal(version.version, 1);
  assert.equal(version.status, 'draft');
  assert.equal(quote.acceptedVersionId, null);
  const second = await repo.createQuote(baseInput());
  assert.equal(second.quote.quoteNumber, quote.quoteNumber + 1);
});

test('non-destructive versioning preserves history; current points to newest', async () => {
  const repo = new InMemoryQuoteRepository();
  const { quote, version } = await repo.createQuote(baseInput());
  version.scopes.push({ id: ulid(), title: 'Deck', description: '', order: 0, lines: [] });
  await repo.saveVersion(version);

  const v2 = await repo.newVersionFrom(quote.id);
  assert.equal(v2.version, 2);

  const all = await repo.listVersions(quote.id);
  assert.equal(all.length, 2);
  const current = await repo.getCurrentVersion(quote.id);
  assert.equal(current.id, v2.id);
  assert.equal(all.find((v) => v.version === 1).scopes.length, 1); // v1 untouched
});

test('accept marks acceptedVersionId on the root', async () => {
  const repo = new InMemoryQuoteRepository();
  const { quote, version } = await repo.createQuote(baseInput());
  await repo.setStatus(version.id, 'accepted');
  const q = await repo.getQuote(quote.id);
  assert.equal(q.acceptedVersionId, version.id);
});

test('duplicate-as-template: fresh draft, copied scopes with NEW ids', async () => {
  const repo = new InMemoryQuoteRepository();
  const { quote, version } = await repo.createQuote(baseInput());
  const sId = ulid();
  version.scopes.push({
    id: sId, title: 'Path', description: '', order: 0,
    lines: [{ id: ulid(), type: 'material', description: 'Pavers', unit: 'each', quantity: 10, costRateCents: 3717, costRateGstInclusive: false, pricing: { method: 'margin', rate: 0.40 }, rateCardItemId: null, order: 0 }],
  });
  await repo.saveVersion(version);

  const dup = await repo.duplicateAsTemplate(quote.id, { clientId: ulid(), propertyId: ulid(), clientName: 'New Client', address: '9 New Rd' });
  assert.notEqual(dup.quote.id, quote.id);
  assert.equal(dup.version.scopes.length, 1);
  assert.notEqual(dup.version.scopes[0].id, sId);              // new scope id
  assert.equal(dup.version.scopes[0].lines.length, 1);
  assert.equal(dup.version.status, 'draft');
});

test('search by address/client; filter by status; record actuals', async () => {
  const repo = new InMemoryQuoteRepository();
  const a = await repo.createQuote({ clientId: ulid(), propertyId: ulid(), clientName: 'Ger Murphy', address: '5 Beach Rd' });
  await repo.createQuote({ clientId: ulid(), propertyId: ulid(), clientName: 'Jane Doe', address: '12 Smith St' });

  const byText = await repo.listQuotes({ text: 'beach' });
  assert.equal(byText.length, 1);
  assert.equal(byText[0].id, a.quote.id);

  await repo.setStatus(a.version.id, 'accepted');
  assert.equal((await repo.listQuotes({ status: 'accepted' })).length, 1);

  await repo.addActual({ quoteId: a.quote.id, scopeId: null, lineItemId: null, description: 'Skip bin', amountCents: 12000 });
  const actuals = await repo.listActuals(a.quote.id);
  assert.equal(actuals.length, 1);
  assert.equal(actuals[0].amountCents, 12000);
});
