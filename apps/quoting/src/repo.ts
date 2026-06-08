// Repository singleton (the swappable seam) + business details for the client document.
// IndexedDB on a real device (offline-tolerant); in-memory fallback if unavailable.

import { IndexedDbQuoteRepository, InMemoryQuoteRepository, type QuoteRepository } from '@rapid-refresh/data';

export const repo: QuoteRepository =
  typeof indexedDB !== 'undefined' ? new IndexedDbQuoteRepository() : new InMemoryQuoteRepository();

// Editable later via an admin panel; placeholder defaults for now (flagged).
export const BUSINESS = {
  name: 'Rapid Refresh',
  gstNumber: '123-456-789', // FLAG: replace with real NZ GST number
  email: 'hello@rapidrefresh.co',
  phone: '+64 …',
  terms: 'Quote valid for the period shown. Prices exclude GST unless stated. Work scheduled on acceptance.',
  deposit: 'A deposit may be required to confirm booking and order materials.',
};
