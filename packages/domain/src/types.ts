// types.ts — the quote schema. This is the CONTRACT other modules (jobs, invoicing, CRM) read/write.
// Shared entities (client, property, crew, rate card) are referenced by id, never duplicated here.

import type { Id } from './ids.ts';
import type { Pricing } from '../../pricing/src/index.ts';

export type { Id, Pricing };

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced';
export type LineType = 'material' | 'labour' | 'other';
export type Unit = 'm2' | 'm3' | 'lineal_m' | 'each' | 'hour' | 'load' | 'flat';

/** A single priced line. Rate values are SNAPSHOTTED here when added (rateCardItemId = provenance),
 *  so editing the rate card later never changes historical quotes. Computed cost/sell are derived
 *  through the pricing layer — not stored as source of truth. */
export interface LineItem {
  id: Id;
  type: LineType;
  description: string;
  unit: Unit;
  quantity: number;
  costRateCents: number;
  costRateGstInclusive: boolean;  // supplier/Bunnings price → stripped ÷1.15 at compute time
  pricing: Pricing;               // margin | passthrough | charge
  rateCardItemId: Id | null;
  supplier?: string;              // which supplier this cost came from (e.g. 'CLS', 'Garden Box')
  order: number;
}

/** Scopes stay separate and are never auto-combined into one total. */
export interface Scope {
  id: Id;
  title: string;
  description: string;
  order: number;
  lines: LineItem[];
}

/** One edit = one immutable version. History is preserved. */
export interface QuoteVersion {
  id: Id;
  quoteId: Id;          // → Quote.id (the permanent root reference)
  version: number;
  status: QuoteStatus;
  validFrom: string;    // ISO
  validUntil: string;   // ISO
  terms: string;
  depositTerms: string;
  scopes: Scope[];
  createdAt: string;
  updatedAt: string;
}

/** The permanent root. Other systems reference `id` forever. `quoteNumber` is human-facing. */
export interface Quote {
  id: Id;
  quoteNumber: number;
  clientId: Id;
  propertyId: Id;
  /** Cached display label refreshed from CRM — for offline list/search. Source of truth stays in CRM. */
  clientName: string;
  address: string;
  /** Cached client contact — shown on the client document. Optional (older quotes predate these / CRM owns truth). */
  clientPhone?: string;
  clientEmail?: string;
  /** Internal site/access notes (gate code, dog, parking). NEVER shown on the client document. */
  siteNotes?: string;
  currentVersionId: Id;
  acceptedVersionId: Id | null;
  createdAt: string;
  updatedAt: string;
}

/** A supplier-specific cost for a rate-card item (multi-supplier pricing). */
export interface SupplierCost {
  supplier: string;             // e.g. 'CLS', 'Garden Box'
  costRateCents: number;
  costRateGstInclusive: boolean;
  notes?: string;
}

/** Shared rate card — seeded as editable defaults, referenced by id from lines. */
export interface RateCardItem {
  id: Id;
  key: string;
  label: string;
  unit: Unit;
  type: LineType;
  costRateCents: number | null;        // primary/default cost (kept for back-compat)
  costRateGstInclusive: boolean;
  sellRateCents: number | null;        // for charge-method items
  defaultPricing: Pricing;
  suppliers?: SupplierCost[];          // optional per-supplier costs; pick one at quote time
  modifiers?: { fuelLevy?: number; deliveryPerLoadCents?: number; capacityM3?: number };
  notes?: string;
  active: boolean;
}

/** Track-actuals: real costs recorded against an accepted quote → margin reconciliation. */
export interface ActualEntry {
  id: Id;
  quoteId: Id;
  scopeId: Id | null;
  lineItemId: Id | null;
  description: string;
  amountCents: number;
  recordedAt: string;
}
