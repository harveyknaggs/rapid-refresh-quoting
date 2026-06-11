// suppliers.ts — multi-supplier cost resolution. Each rate-card item can hold costs from several
// suppliers (CLS, Garden Box, …); at quote time you pick one. Pure, additive, back-compatible:
// items with no `suppliers` array just use their primary cost.

import type { RateCardItem, SupplierCost } from './types.ts';

/** Default supplier when none is chosen. */
export const DEFAULT_SUPPLIER = 'CLS';

/** Known suppliers (for pickers). Extend as more are added. */
export const SUPPLIERS = ['CLS', 'Garden Box', 'Frews', 'Fulton Hogan'] as const;

/** Quarry suppliers — their aggregate is NOT subject to the landscaping-yard fuel levy.
 *  The 7% levy applies to materials from landscaping yards (Dyers Road, CLS, Garden Box, Mainscape…),
 *  not to quarry aggregate (Frews, Fulton Hogan). */
export const LEVY_EXEMPT_SUPPLIERS = ['Frews', 'Fulton Hogan'];

/** Does the fuel levy apply to a material from this supplier? Yards → yes; quarries → no; unknown → yes. */
export const leviesApply = (supplier?: string): boolean => !LEVY_EXEMPT_SUPPLIERS.includes(supplier ?? '');

/** Default supplier for an item: explicit `defaultSupplier` wins, else pavers → Garden Box, else CLS. */
export const defaultSupplierFor = (item: Pick<RateCardItem, 'key' | 'label'> & { defaultSupplier?: string }): string => {
  if (item.defaultSupplier) return item.defaultSupplier;
  return /paver|paving/i.test(`${item.key} ${item.label}`) ? 'Garden Box' : DEFAULT_SUPPLIER;
};

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
