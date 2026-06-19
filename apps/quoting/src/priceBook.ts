// Live price book: reads the published PriceBook tab (CSV) from the Google Sheet that the
// invoice pipeline keeps current. Falls back to the in-code seed (and a cached copy) offline.

import { seedRateCard, type RateCardItem, type Unit, type Pricing } from '@rapid-refresh/domain';

const URL_KEY = 'rr.priceBookUrl';
const CACHE_KEY = 'rr.priceBookCache.v1';

export const getPriceBookUrl = (): string => { try { return localStorage.getItem(URL_KEY) || ''; } catch { return ''; } };
export const setPriceBookUrl = (u: string): void => { try { localStorage.setItem(URL_KEY, u.trim()); } catch { /* */ } };

const UNIT_MAP: Record<string, Unit> = {
  'm2': 'm2', 'm²': 'm2', 'sqm': 'm2', 'm3': 'm3', 'm³': 'm3',
  'lineal m': 'lineal_m', 'lineal_m': 'lineal_m', 'lm': 'lineal_m', 'lin m': 'lineal_m',
  'each': 'each', 'ea': 'each', 'hour': 'hour', 'hr': 'hour', 'hrs': 'hour',
  'load': 'load', 'flat': 'flat', 'bag': 'each', 'tonne': 'each',
};
const toUnit = (s: string): Unit => UNIT_MAP[(s || '').trim().toLowerCase()] || 'each';
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const numOf = (s: string): number => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas and newlines in fields). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Columns: Item | Unit | Cost $/unit (ex GST) | GST treatment | Margin % | Supplier | ...
function rowsToItems(rows: string[][]): RateCardItem[] {
  const items: RateCardItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const [item, unit, cost, gst, margin, supplier] = rows[i];
    if (!item || !item.trim()) continue;
    const rate = (numOf(margin) || 40) / 100;
    const pricing: Pricing = { method: 'margin', rate };
    items.push({
      id: 'pb-' + i, key: slug(item), label: item.trim(), unit: toUnit(unit), type: 'material',
      costRateCents: Math.round(numOf(cost) * 100), costRateGstInclusive: /incl/i.test(gst || ''),
      sellRateCents: null, defaultPricing: pricing, notes: supplier ? `from ${supplier}` : undefined, active: true,
    });
  }
  return items;
}

function cached(): RateCardItem[] | null {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

/** The curated built-in price book is ALWAYS the base (so its fixed-rate items, suppliers and the
 *  rates Roy has set are guaranteed present). A live Google Sheet (if set) only ADDS items whose key
 *  isn't already curated — it never overrides or hides a built-in item. */
function mergeWithSeed(sheet: RateCardItem[]): RateCardItem[] {
  const seed = seedRateCard();
  const have = new Set(seed.map((i) => i.key));
  const extra = sheet.filter((i) => i.key && !have.has(i.key));
  return [...seed, ...extra];
}

export async function loadPriceBook(): Promise<RateCardItem[]> {
  const url = getPriceBookUrl();
  if (url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const items = rowsToItems(parseCsv(await res.text()));
        if (items.length) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch { /* */ } return mergeWithSeed(items); }
      }
    } catch { /* fall through */ }
  }
  const c = cached();
  return c ? mergeWithSeed(c) : seedRateCard();
}
