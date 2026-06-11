// repository.ts — the persistence SEAM. UI and other modules depend on this interface only,
// never on a concrete store. Swap adapters (IndexedDB now, REST later) without touching callers.

import type { Id, Quote, QuoteVersion, QuoteStatus, Scope, ActualEntry } from '../../domain/src/index.ts';

export interface NewQuoteInput {
  clientId: Id;
  propertyId: Id;
  clientName: string;   // cached display label (from CRM)
  address: string;      // cached display label (from CRM)
  clientPhone?: string; // cached contact — shown on client doc
  clientEmail?: string;
  siteNotes?: string;   // internal access notes — never on client doc
  validFrom?: string;
  validUntil?: string;
  scopes?: Scope[];
}

/** Quote-level client/property fields that can be edited after creation (cached from CRM later). */
export type QuoteDetailsPatch = Partial<
  Pick<Quote, 'clientName' | 'address' | 'clientPhone' | 'clientEmail' | 'siteNotes'>
>;

export interface QuoteFilter {
  clientId?: Id;
  status?: QuoteStatus;
  text?: string;        // matches client name or address (offline search)
}

export interface QuoteRepository {
  // --- root quotes ---
  createQuote(input: NewQuoteInput): Promise<{ quote: Quote; version: QuoteVersion }>;
  getQuote(id: Id): Promise<Quote | null>;
  listQuotes(filter?: QuoteFilter): Promise<Quote[]>;
  updateQuoteDetails(id: Id, patch: QuoteDetailsPatch): Promise<Quote>; // edit cached client/property fields
  deleteQuote(id: Id): Promise<void>; // removes the quote + all its versions and actuals

  // --- versions (non-destructive) ---
  getVersion(id: Id): Promise<QuoteVersion | null>;
  getCurrentVersion(quoteId: Id): Promise<QuoteVersion | null>;
  listVersions(quoteId: Id): Promise<QuoteVersion[]>;
  saveVersion(version: QuoteVersion): Promise<QuoteVersion>;   // upsert the editable (draft) version
  newVersionFrom(quoteId: Id): Promise<QuoteVersion>;          // clone current → new version, history kept
  setStatus(versionId: Id, status: QuoteStatus): Promise<QuoteVersion>; // 'accepted' sets acceptedVersionId

  // --- duplicate as template ---
  duplicateAsTemplate(quoteId: Id, into: { clientId: Id; propertyId: Id; clientName: string; address: string }):
    Promise<{ quote: Quote; version: QuoteVersion }>;

  // --- actuals ---
  addActual(entry: Omit<ActualEntry, 'id' | 'recordedAt'> & { recordedAt?: string }): Promise<ActualEntry>;
  listActuals(quoteId: Id): Promise<ActualEntry[]>;
}
