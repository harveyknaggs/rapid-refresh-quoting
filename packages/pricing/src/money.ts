// money.ts — money, GST and true-margin primitives.
// Pure, framework-agnostic, zero-dependency. All money is integer cents.
// Reusable identically across quoting, invoicing and reporting.

export type Cents = number;

/** NZ GST rate. */
export const GST_RATE = 0.15;

/** Round half away from zero (so .5 always rounds up in magnitude). */
const halfAwayFromZero = (n: number): number => (n < 0 ? -Math.round(-n) : Math.round(n));

/** Round a (possibly fractional) cents value to a whole cent. */
export const roundCents = (cents: number): Cents => halfAwayFromZero(cents);

/** Round a cents value to the nearest whole DOLLAR (the line-level rounding rule). */
export const roundToDollar = (cents: number): Cents => halfAwayFromZero(cents / 100) * 100;

export const toDollars = (cents: Cents): number => cents / 100;
export const fromDollars = (dollars: number): Cents => halfAwayFromZero(dollars * 100);

// ---------- GST (NZ 15%) ----------

/** Strip GST from a GST-inclusive amount → true ex-GST cost (supplier/Bunnings prices). */
export const stripGst = (inclCents: number, rate: number = GST_RATE): Cents =>
  roundCents(inclCents / (1 + rate));

/** GST component on an ex-GST amount (shown as its own line on output). */
export const gstOf = (exCents: number, rate: number = GST_RATE): Cents =>
  roundCents(exCents * rate);

/** GST-inclusive amount from an ex-GST amount. */
export const inclOf = (exCents: number, rate: number = GST_RATE): Cents =>
  exCents + gstOf(exCents, rate);

// ---------- True margin (NEVER markup) ----------

/** Raw sell from cost using TRUE margin: sell = cost / (1 - margin). Unrounded. */
export const rawSellFromCost = (costCents: number, margin: number): number =>
  costCents / (1 - margin);

/** Effective margin implied by a cost & sell: (sell - cost) / sell. */
export const marginOf = (costCents: number, sellCents: number): number =>
  sellCents === 0 ? 0 : (sellCents - costCents) / sellCents;

export const profitOf = (costCents: number, sellCents: number): Cents => sellCents - costCents;

/** Quote default margin is meant to sit in the 35–45% band; flag anything outside. */
export const isMarginOutsideBand = (margin: number, lo = 0.35, hi = 0.45): boolean =>
  margin < lo || margin > hi;
