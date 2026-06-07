// quote.ts — line / scope / quote rollups, sensitivity, actuals reconciliation, validation.
// Pure. No storage, no framework. Quoting, invoicing and reporting all compute through here.

import {
  roundToDollar, stripGst, gstOf, rawSellFromCost, marginOf, profitOf, isMarginOutsideBand,
  type Cents,
} from './money.ts';

/**
 * How a line turns cost into sell. Margin ALWAYS applies to cost, never to a sell rate.
 *  - margin:      sell = cost / (1 - rate)      e.g. materials, labour (on $37 cost)
 *  - passthrough: sell = cost                   at-cost lines
 *  - charge:      sell = sellRate × qty         fixed sell rates (turf $190, deck-stain $32, lawn $65)
 */
export type Pricing =
  | { method: 'margin'; rate: number }
  | { method: 'passthrough' }
  | { method: 'charge'; sellRateCents: number };

export interface LineInput {
  quantity: number;
  costRateCents: number;
  costRateGstInclusive?: boolean; // supplier/Bunnings = true → ÷1.15 to true cost
  pricing: Pricing;
}
export interface LineResult {
  costCents: Cents;
  sellCents: Cents;
  effectiveMargin: number;
  profitCents: Cents;
}

export const computeLine = (input: LineInput): LineResult => {
  const trueRate = input.costRateGstInclusive ? stripGst(input.costRateCents) : input.costRateCents;
  const costCents = Math.round(trueRate * input.quantity);

  let sellCents: number;
  switch (input.pricing.method) {
    case 'margin':
      sellCents = roundToDollar(rawSellFromCost(costCents, input.pricing.rate));
      break;
    case 'passthrough':
      sellCents = roundToDollar(costCents);
      break;
    case 'charge':
      sellCents = roundToDollar(input.pricing.sellRateCents * input.quantity);
      break;
  }

  return {
    costCents,
    sellCents,
    effectiveMargin: marginOf(costCents, sellCents),
    profitCents: profitOf(costCents, sellCents),
  };
};

export interface Totals {
  costCents: Cents;
  sellCents: Cents;
  marginPct: number;
  profitCents: Cents;
}

/** Scope total = sum of ALREADY-ROUNDED line sells (totals are the sum of rounded lines). */
export const computeScope = (lines: LineResult[]): Totals => {
  const costCents = lines.reduce((s, l) => s + l.costCents, 0);
  const sellCents = lines.reduce((s, l) => s + l.sellCents, 0);
  return { costCents, sellCents, marginPct: marginOf(costCents, sellCents), profitCents: sellCents - costCents };
};

export interface QuoteTotals extends Totals {
  blendedMargin: number;
  gstCents: Cents;
  grandTotalInclCents: Cents;
}

/** Quote rollup across scopes. Scopes are summed, NEVER merged into one line. */
export const computeQuote = (scopes: Totals[]): QuoteTotals => {
  const costCents = scopes.reduce((s, x) => s + x.costCents, 0);
  const sellCents = scopes.reduce((s, x) => s + x.sellCents, 0);
  const gstCents = gstOf(sellCents);
  return {
    costCents,
    sellCents,
    marginPct: marginOf(costCents, sellCents),
    profitCents: sellCents - costCents,
    blendedMargin: marginOf(costCents, sellCents),
    gstCents,
    grandTotalInclCents: sellCents + gstCents,
  };
};

export interface SensitivityRow { rate: number; sellCents: Cents; profitCents: Cents; }

/** Margin sensitivity: sell + profit at each rate (default 35 / 40 / 45%). */
export const sensitivity = (costCents: number, rates: number[] = [0.35, 0.40, 0.45]): SensitivityRow[] =>
  rates.map((rate) => {
    const sellCents = roundToDollar(rawSellFromCost(costCents, rate));
    return { rate, sellCents, profitCents: sellCents - costCents };
  });

export interface Reconciliation {
  actualMargin: number;
  targetMargin: number;
  onTarget: boolean;
  sellToRecoverTargetCents: Cents;
  shortfallVsQuotedCents: Cents;
}

/** Track-actuals: real cost vs a quoted sell, plus the sell needed to recover target margin. */
export const reconcile = (quotedSellCents: number, actualCostCents: number, targetMargin: number): Reconciliation => {
  const actualMargin = marginOf(actualCostCents, quotedSellCents);
  const sellToRecoverTargetCents = roundToDollar(rawSellFromCost(actualCostCents, targetMargin));
  return {
    actualMargin,
    targetMargin,
    onTarget: actualMargin >= targetMargin,
    sellToRecoverTargetCents,
    shortfallVsQuotedCents: sellToRecoverTargetCents - quotedSellCents,
  };
};

export interface Issue { code: string; message: string; }

/** Validation warnings (real-money guardrails). */
export const validateLine = (line: {
  type: 'material' | 'labour' | 'other';
  quantity: number;
  costRateCents: number;
  pricing: Pricing;
}): Issue[] => {
  const issues: Issue[] = [];
  if (line.type === 'labour' && (!line.quantity || line.quantity <= 0)) {
    issues.push({ code: 'labour-no-hours', message: 'Labour line has no hours.' });
  }
  if (line.costRateCents > 0 && line.pricing.method === 'margin' && isMarginOutsideBand(line.pricing.rate)) {
    issues.push({ code: 'margin-out-of-band', message: `Margin ${(line.pricing.rate * 100).toFixed(0)}% is outside the 35–45% band.` });
  }
  if (line.pricing.method === 'charge' && line.pricing.sellRateCents <= 0) {
    issues.push({ code: 'no-sell-rate', message: 'Charge line has no sell rate.' });
  }
  return issues;
};
