// Display + parsing helpers. Money is cents everywhere; UI formats at the edges.

export const fmt = (cents: number): string =>
  (cents / 100).toLocaleString('en-NZ', { style: 'currency', currency: 'NZD' });

export const pct = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

/** Parse a dollar string ("84.50", "$1,200") to integer cents. */
export const dollarsToCents = (s: string): number => {
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const num = (s: string): number => {
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
