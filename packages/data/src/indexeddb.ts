// indexeddb.ts — offline-on-site adapter (browser only). Same contract as the in-memory adapter.
// Later a REST adapter implements QuoteRepository identically; callers never change.

import {
  ulid, nowIso,
  type Id, type Quote, type QuoteVersion, type QuoteStatus, type Scope, type ActualEntry,
} from '../../domain/src/index.ts';
import type { QuoteRepository, NewQuoteInput, QuoteFilter, QuoteDetailsPatch } from './repository.ts';

const DB_NAME = 'rr-quoting';
const DB_VERSION = 1;
const DAY = 86_400_000;

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

const cloneScopes = (scopes: Scope[], freshIds: boolean): Scope[] =>
  scopes.map((s) => ({
    ...s, id: freshIds ? ulid() : s.id,
    lines: s.lines.map((l) => ({ ...l, id: freshIds ? ulid() : l.id })),
  }));

export class IndexedDbQuoteRepository implements QuoteRepository {
  #dbp: Promise<IDBDatabase>;

  constructor() {
    this.#dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('quotes')) db.createObjectStore('quotes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('versions')) {
          const vs = db.createObjectStore('versions', { keyPath: 'id' });
          vs.createIndex('byQuote', 'quoteId', { unique: false });
        }
        if (!db.objectStoreNames.contains('actuals')) {
          const as = db.createObjectStore('actuals', { keyPath: 'id' });
          as.createIndex('byQuote', 'quoteId', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }

  async #tx(stores: string[], mode: IDBTransactionMode): Promise<IDBTransaction> {
    const db = await this.#dbp;
    return db.transaction(stores, mode);
  }

  async #nextNumber(): Promise<number> {
    const tx = await this.#tx(['meta'], 'readwrite');
    const store = tx.objectStore('meta');
    const row = await req<{ key: string; value: number } | undefined>(store.get('quoteNumber'));
    const next = (row?.value ?? 1000) + 1;
    await req(store.put({ key: 'quoteNumber', value: next }));
    return next;
  }

  async createQuote(input: NewQuoteInput): Promise<{ quote: Quote; version: QuoteVersion }> {
    const number = await this.#nextNumber();
    const quoteId = ulid();
    const versionId = ulid();
    const ts = nowIso();
    const version: QuoteVersion = {
      id: versionId, quoteId, version: 1, status: 'draft',
      validFrom: input.validFrom ?? ts,
      validUntil: input.validUntil ?? new Date(Date.now() + 30 * DAY).toISOString(),
      terms: '', depositTerms: '', scopes: input.scopes ?? [], createdAt: ts, updatedAt: ts,
    };
    const quote: Quote = {
      id: quoteId, quoteNumber: number, clientId: input.clientId, propertyId: input.propertyId,
      clientName: input.clientName, address: input.address,
      clientPhone: input.clientPhone, clientEmail: input.clientEmail, siteNotes: input.siteNotes,
      currentVersionId: versionId, acceptedVersionId: null, createdAt: ts, updatedAt: ts,
    };
    const tx = await this.#tx(['quotes', 'versions'], 'readwrite');
    await Promise.all([req(tx.objectStore('quotes').put(quote)), req(tx.objectStore('versions').put(version))]);
    return { quote, version };
  }

  async getQuote(id: Id): Promise<Quote | null> {
    const tx = await this.#tx(['quotes'], 'readonly');
    return (await req<Quote | undefined>(tx.objectStore('quotes').get(id))) ?? null;
  }

  async updateQuoteDetails(id: Id, patch: QuoteDetailsPatch): Promise<Quote> {
    const tx = await this.#tx(['quotes'], 'readwrite');
    const q = await req<Quote | undefined>(tx.objectStore('quotes').get(id));
    if (!q) throw new Error(`Unknown quote ${id}`);
    Object.assign(q, patch, { updatedAt: nowIso() });
    await req(tx.objectStore('quotes').put(q));
    return q;
  }

  async deleteQuote(id: Id): Promise<void> {
    const tx = await this.#tx(['quotes', 'versions', 'actuals'], 'readwrite');
    await req(tx.objectStore('quotes').delete(id));
    for (const store of ['versions', 'actuals']) {
      const keys = await req<IDBValidKey[]>(tx.objectStore(store).index('byQuote').getAllKeys(id));
      await Promise.all(keys.map((k) => req(tx.objectStore(store).delete(k))));
    }
  }

  async listQuotes(filter: QuoteFilter = {}): Promise<Quote[]> {
    const tx = await this.#tx(['quotes', 'versions'], 'readonly');
    let quotes = await req<Quote[]>(tx.objectStore('quotes').getAll());
    const text = filter.text?.trim().toLowerCase();
    if (filter.clientId) quotes = quotes.filter((q) => q.clientId === filter.clientId);
    if (text) quotes = quotes.filter((q) => `${q.clientName} ${q.address}`.toLowerCase().includes(text));
    if (filter.status) {
      const vstore = tx.objectStore('versions');
      const keep: Quote[] = [];
      for (const q of quotes) {
        const v = await req<QuoteVersion | undefined>(vstore.get(q.currentVersionId));
        if (v && v.status === filter.status) keep.push(q);
      }
      quotes = keep;
    }
    return quotes.sort((a, b) => b.quoteNumber - a.quoteNumber);
  }

  async getVersion(id: Id): Promise<QuoteVersion | null> {
    const tx = await this.#tx(['versions'], 'readonly');
    return (await req<QuoteVersion | undefined>(tx.objectStore('versions').get(id))) ?? null;
  }

  async getCurrentVersion(quoteId: Id): Promise<QuoteVersion | null> {
    const q = await this.getQuote(quoteId);
    return q ? this.getVersion(q.currentVersionId) : null;
  }

  async listVersions(quoteId: Id): Promise<QuoteVersion[]> {
    const tx = await this.#tx(['versions'], 'readonly');
    const all = await req<QuoteVersion[]>(tx.objectStore('versions').index('byQuote').getAll(quoteId));
    return all.sort((a, b) => a.version - b.version);
  }

  async saveVersion(version: QuoteVersion): Promise<QuoteVersion> {
    const updated: QuoteVersion = { ...version, updatedAt: nowIso() };
    const tx = await this.#tx(['versions', 'quotes'], 'readwrite');
    await req(tx.objectStore('versions').put(updated));
    const q = await req<Quote | undefined>(tx.objectStore('quotes').get(version.quoteId));
    if (q) { q.updatedAt = updated.updatedAt; await req(tx.objectStore('quotes').put(q)); }
    return updated;
  }

  async newVersionFrom(quoteId: Id): Promise<QuoteVersion> {
    const current = await this.getCurrentVersion(quoteId);
    if (!current) throw new Error(`Unknown quote ${quoteId}`);
    const ts = nowIso();
    const next: QuoteVersion = {
      ...current, id: ulid(), version: current.version + 1, status: 'draft',
      scopes: cloneScopes(current.scopes, true), createdAt: ts, updatedAt: ts,
    };
    const tx = await this.#tx(['versions', 'quotes'], 'readwrite');
    await req(tx.objectStore('versions').put(next));
    const q = await req<Quote | undefined>(tx.objectStore('quotes').get(quoteId));
    if (q) { q.currentVersionId = next.id; q.updatedAt = ts; await req(tx.objectStore('quotes').put(q)); }
    return next;
  }

  async setStatus(versionId: Id, status: QuoteStatus): Promise<QuoteVersion> {
    const tx = await this.#tx(['versions', 'quotes'], 'readwrite');
    const v = await req<QuoteVersion | undefined>(tx.objectStore('versions').get(versionId));
    if (!v) throw new Error(`Unknown version ${versionId}`);
    v.status = status; v.updatedAt = nowIso();
    await req(tx.objectStore('versions').put(v));
    if (status === 'accepted') {
      const q = await req<Quote | undefined>(tx.objectStore('quotes').get(v.quoteId));
      if (q) { q.acceptedVersionId = versionId; q.updatedAt = v.updatedAt; await req(tx.objectStore('quotes').put(q)); }
    }
    return v;
  }

  async duplicateAsTemplate(
    quoteId: Id,
    into: { clientId: Id; propertyId: Id; clientName: string; address: string },
  ): Promise<{ quote: Quote; version: QuoteVersion }> {
    const source = await this.getCurrentVersion(quoteId);
    if (!source) throw new Error(`Unknown quote ${quoteId}`);
    return this.createQuote({ ...into, scopes: cloneScopes(source.scopes, true) });
  }

  async addActual(entry: Omit<ActualEntry, 'id' | 'recordedAt'> & { recordedAt?: string }): Promise<ActualEntry> {
    const full: ActualEntry = { ...entry, id: ulid(), recordedAt: entry.recordedAt ?? nowIso() };
    const tx = await this.#tx(['actuals'], 'readwrite');
    await req(tx.objectStore('actuals').put(full));
    return full;
  }

  async listActuals(quoteId: Id): Promise<ActualEntry[]> {
    const tx = await this.#tx(['actuals'], 'readonly');
    return req<ActualEntry[]>(tx.objectStore('actuals').index('byQuote').getAll(quoteId));
  }
}
