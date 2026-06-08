// Business details live in-app (admin-editable), never hardcoded. Persisted on the device.
import { BUSINESS } from './repo.ts';

export type Business = typeof BUSINESS;
const KEY = 'rr.business.v1';

export const getBusiness = (): Business => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...BUSINESS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return BUSINESS;
};

export const saveBusiness = (b: Business): void => {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* ignore */ }
};
