// suppliers.ts — multi-supplier cost resolution. Each rate-card item can hold costs from several
// suppliers (CLS, Garden Box, …); at quote time you pick one. Pure, additive, back-compatible:
// items with no `suppliers` array just use their primary cost.

import type { RateCardItem, SupplierCost } from './types.ts';

/** Default supplier when none is chosen. */
export const DEFAULT_SUPPLIER = 'CLS';

/** Known suppliers (for pickers). Extend as more are added. */
export const SUPPLIERS = ['CLS', 'Garden Box', 'Frews', 'Fulton Hogan'] as const;

/** Default supplier for an item: pavers → Garden Box, everything else → CLS. */
export const defaultSupplierFor = (item: Pick<RateCardItem, 'key' | 'label'>): string =>
  /paver|paving/i.test(`${item.key} ${item.label}`) ? 'Garden Box' : DEFAULT_SUPPLIER;

export interface ResolvedCost {
  supplier: string;
  costRateCents: number | null;
  costRateGstInclusive: boolean;
}

/**
 * Resolve the cost to use for an item given a chosen supplier.
 * Falls back to the requested supplier's default, then the item's primary cost.
 */
export const resolveSupplierCost = (item: RateCardItem, supplier?: string): ResolvedCost => {
  const want = supplier ?? defaultSupplierFor(item);
  const match: SupplierCost | undefined = item.suppliers?.find((s) => s.supplier === want);
  if (match) {
    return { supplier: want, costRateCents: match.costRateCents, costRateGstInclusive: match.costRateGstInclusive };
  }
  // No per-supplier entry — use the item's primary cost. Label it with the first known supplier
  // for the item (its `suppliers` source), else the requested supplier.
  const primarySupplier = item.suppliers?.[0]?.supplier ?? want;
  return { supplier: primarySupplier, costRateCents: item.costRateCents, costRateGstInclusive: item.costRateGstInclusive };
};

/** Suppliers available to pick for an item (primary + any extras), for a dropdown. */
export const suppliersFor = (item: RateCardItem): string[] => {
  const set = new Set<string>([defaultSupplierFor(item)]);
  for (const s of item.suppliers ?? []) set.add(s.supplier);
  return [...set];
};
