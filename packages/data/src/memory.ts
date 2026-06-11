// memory.ts — in-memory adapter. Used for tests and as a safe default; proves the interface.
// Same behaviour the IndexedDB/REST adapters must honour.

import {
  ulid, nowIso,
  type Id, type Quote, type QuoteVersion, type QuoteStatus, type Scope, type ActualEntry,
} from '../../domain/src/index.ts';
import type { QuoteRepository, NewQuoteInput, QuoteFilter, QuoteDetailsPatch } from './repository.ts';

const DAY = 86_400_000;

const cloneScopes = (scopes: Scope[], freshIds: boolean): Scope[] =>
  scopes.map((s) => ({
    ...s,
    id: freshIds ? ulid() : s.id,
    lines: s.lines.map((l) => ({ ...l, id: freshIds ? ulid() : l.id })),
  }));

export class InMemoryQuoteRepository implements QuoteRepository {
  #quotes = new Map<Id, Quote>();
  #versions = new Map<Id, QuoteVersion>();
  #actuals: ActualEntry[] = [];
  #nextNumber = 1001;

  async createQuote(input: NewQuoteInput): Promise<{ quote: Quote; version: QuoteVersion }> {
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
      id: quoteId, quoteNumber: this.#nextNumber++,
      clientId: input.clientId, propertyId: input.propertyId,
      clientName: input.clientName, address: input.address,
      clientPhone: input.clientPhone, clientEmail: input.clientEmail, siteNotes: input.siteNotes,
      currentVersionId: versionId, acceptedVersionId: null, createdAt: ts, updatedAt: ts,
    };
    this.#quotes.set(quoteId, quote);
    this.#versions.set(versionId, version);
    return { quote: { ...quote }, version: structuredClone(version) };
  }

  async getQuote(id: Id): Promise<Quote | null> {
    const q = this.#quotes.get(id);
    return q ? { ...q } : null;
  }

  async updateQuoteDetails(id: Id, patch: QuoteDetailsPatch): Promise<Quote> {
    const q = this.#quotes.get(id);
    if (!q) throw new Error(`Unknown quote ${id}`);
    Object.assign(q, patch, { updatedAt: nowIso() });
    return { ...q };
  }

  async deleteQuote(id: Id): Promise<void> {
    this.#quotes.delete(id);
    for (const [vid, v] of this.#versions) if (v.quoteId === id) this.#versions.delete(vid);
    this.#actuals = this.#actuals.filter((a) => a.quoteId !== id);
  }

  async listQuotes(filter: QuoteFilter = {}): Promise<Quote[]> {
    const text = filter.text?.trim().toLowerCase();
    const out: Quote[] = [];
    for (const q of this.#quotes.values()) {
      if (filter.clientId && q.clientId !== filter.clientId) continue;
      if (text && !(`${q.clientName} ${q.address}`.toLowerCase().includes(text))) continue;
      if (filter.status) {
        const cur = this.#versions.get(q.currentVersionId);
        if (!cur || cur.status !== filter.status) continue;
      }
      out.push({ ...q });
    }
    return out.sort((a, b) => b.quoteNumber - a.quoteNumber);
  }

  async getVersion(id: Id): Promise<QuoteVersion | null> {
    const v = this.#versions.get(id);
    return v ? structuredClone(v) : null;
  }

  async getCurrentVersion(quoteId: Id): Promise<QuoteVersion | null> {
    const q = this.#quotes.get(quoteId);
    if (!q) return null;
    const v = this.#versions.get(q.currentVersionId);
    return v ? structuredClone(v) : null;
  }

  async listVersions(quoteId: Id): Promise<QuoteVersion[]> {
    return [...this.#versions.values()]
      .filter((v) => v.quoteId === quoteId)
      .sort((a, b) => a.version - b.version)
      .map((v) => structuredClone(v));
  }

  async saveVersion(version: QuoteVersion): Promise<QuoteVersion> {
    const existing = this.#versions.get(version.id);
    if (!existing) throw new Error(`Unknown version ${version.id}`);
    const updated: QuoteVersion = { ...version, updatedAt: nowIso() };
    this.#versions.set(version.id, structuredClone(updated));
    const q = this.#quotes.get(version.quoteId);
    if (q) { q.updatedAt = updated.updatedAt; }
    return structuredClone(updated);
  }

  async newVersionFrom(quoteId: Id): Promise<QuoteVersion> {
    const q = this.#quotes.get(quoteId);
    if (!q) throw new Error(`Unknown quote ${quoteId}`);
    const current = this.#versions.get(q.currentVersionId);
    if (!current) throw new Error(`Quote ${quoteId} has no current version`);
    const ts = nowIso();
    const next: QuoteVersion = {
      ...structuredClone(current),
      id: ulid(),
      version: current.version + 1,
      status: 'draft',
      scopes: cloneScopes(current.scopes, true),
      createdAt: ts, updatedAt: ts,
    };
    this.#versions.set(next.id, next);
    q.currentVersionId = next.id;
    q.updatedAt = ts;
    return structuredClone(next);
  }

  async setStatus(versionId: Id, status: QuoteStatus): Promise<QuoteVersion> {
    const v = this.#versions.get(versionId);
    if (!v) throw new Error(`Unknown version ${versionId}`);
    v.status = status;
    v.updatedAt = nowIso();
    if (status === 'accepted') {
      const q = this.#quotes.get(v.quoteId);
      if (q) { q.acceptedVersionId = versionId; q.updatedAt = v.updatedAt; }
    }
    return structuredClone(v);
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
    this.#actuals.push(full);
    return { ...full };
  }

  async listActuals(quoteId: Id): Promise<ActualEntry[]> {
    return this.#actuals.filter((a) => a.quoteId === quoteId).map((a) => ({ ...a }));
  }
}
