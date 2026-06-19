// Price book = the curated seed rates with the user's in-app edits (overrides) applied,
// plus any custom rates built in the Rate Builder. All on-device; no external sheet.

import { seedRateCard, type RateCardItem } from '@rapid-refresh/domain';
import { customRateItems } from './customRates.ts';

const OV_KEY = 'rr.rateOverrides.v1';

export type RateOverride = Partial<Pick<RateCardItem,
  'costRateCents' | 'sellRateCents' | 'defaultPricing' | 'costRateGstInclusive' | 'active'>>;

export const getOverrides = (): Record<string, RateOverride> => {
  try { return JSON.parse(localStorage.getItem(OV_KEY) || '{}'); } catch { return {}; }
};
const writeOverrides = (o: Record<string, RateOverride>) => {
  try { localStorage.setItem(OV_KEY, JSON.stringify(o)); } catch { /* */ }
};
export const setOverride = (key: string, patch: RateOverride): void => {
  const o = getOverrides(); o[key] = { ...o[key], ...patch }; writeOverrides(o);
};
export const resetOverride = (key: string): void => {
  const o = getOverrides(); delete o[key]; writeOverrides(o);
};
export const isOverridden = (key: string): boolean => !!getOverrides()[key];

/** Curated rates with the user's edits applied. */
export const getStandardRates = (): RateCardItem[] => {
  const ov = getOverrides();
  return seedRateCard().map((it) => (ov[it.key] ? { ...it, ...ov[it.key] } : it));
};

/** Full price book used when quoting: edited standard rates + custom rates. */
export const getPriceBook = (): RateCardItem[] => [...getStandardRates(), ...customRateItems()];

/** Kept async-shaped for existing callers (no network now). */
export async function loadPriceBook(): Promise<RateCardItem[]> { return getPriceBook(); }
