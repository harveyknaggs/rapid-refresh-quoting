// Public surface of the domain package: schema types, ids, rate-card seed,
// title derivation, and the single pricing path (delegates to @rapid-refresh/pricing).

export * from './ids.ts';
export * from './types.ts';
export * from './rate-card.ts';

import { computeLine, computeScope, computeQuote, type Totals, type QuoteTotals } from '../../pricing/src/index.ts';
import type { Scope, QuoteVersion } from './types.ts';

/** Quotes are titled: "[Client Name] – [Address] – Quote". */
export const deriveTitle = (clientName: string, address: string): string =>
  `${clientName} – ${address} – Quote`;

/** Price one scope through the shared pricing layer (sum of rounded lines). */
export const priceScope = (scope: Scope): Totals =>
  computeScope(scope.lines.map((l) => computeLine({
    quantity: l.quantity,
    costRateCents: l.costRateCents,
    costRateGstInclusive: l.costRateGstInclusive,
    pricing: l.pricing,
  })));

/** Price a whole version: per-scope totals + blended quote totals (with GST line). */
export const priceQuoteVersion = (v: QuoteVersion): { scopes: Totals[]; total: QuoteTotals } => {
  const scopes = v.scopes.map(priceScope);
  return { scopes, total: computeQuote(scopes) };
};
