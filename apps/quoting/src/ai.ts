// "Describe the job → auto-filled, priced line items." Calls our own /api/generate
// endpoint, which holds the Anthropic key server-side and talks to Claude. No key
// lives in the browser, so anyone (Roy included) can use it with no setup.
// The app's pricing engine does the final maths — the model only produces line INPUTS.

import { ulid, type RateCardItem, type Scope, type LineItem, type Pricing, type Unit, type LineType } from '@rapid-refresh/domain';

const UNITS: Unit[] = ['m2', 'm3', 'lineal_m', 'each', 'hour', 'load', 'flat'];
const normUnit = (u: string): Unit => (UNITS.indexOf(u as Unit) >= 0 ? u as Unit : 'each');
const normType = (t: string): LineType => (t === 'labour' || t === 'other' ? t : 'material');
function normPricing(p: any): Pricing {
  if (p && p.method === 'charge') return { method: 'charge', sellRateCents: Math.round(Number(p.sellRateCents) || 0) };
  if (p && p.method === 'passthrough') return { method: 'passthrough' };
  return { method: 'margin', rate: Number(p && p.rate) || 0.40 };
}

function parseJson(text: string): any {
  let t = String(text).trim();
  // Pull JSON out of a ```json … ``` (or ```) fence if the model wrapped it.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through to extraction */ }
  // Extract the outermost JSON object/array even if there's prose around it.
  const starts = ['{', '['].map((c) => t.indexOf(c)).filter((i) => i >= 0);
  const first = starts.length ? Math.min(...starts) : -1;
  const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch { /* fall through */ }
  }
  // Couldn't parse — surface what the AI actually said so it's diagnosable.
  const said = t.replace(/\s+/g, ' ').trim().slice(0, 180) || '(empty response)';
  throw new Error('The AI didn’t return usable line items. It said: “' + said + '”');
}

function toScopes(parsed: any): Scope[] {
  const arr = (parsed && parsed.scopes) || [];
  return arr.map((s: any, si: number): Scope => ({
    id: ulid(), title: s.title || 'Scope', description: s.description || '', order: si,
    lines: ((s.lines) || []).map((l: any, li: number): LineItem => ({
      id: ulid(), type: normType(l.type), description: l.description || '', unit: normUnit(l.unit),
      quantity: Number(l.quantity) || 0, costRateCents: Math.round(Number(l.costRateCents) || 0),
      costRateGstInclusive: !!l.costRateGstInclusive, pricing: normPricing(l.pricing),
      rateCardItemId: null, supplier: l.supplier || undefined, order: li,
    })),
  }));
}

export async function generateScopes(description: string, rateCard: RateCardItem[]): Promise<Scope[]> {
  const priceBook = rateCard.map((r) => ({
    item: r.label, unit: r.unit, costCents: r.costRateCents,
    gstInclusive: r.costRateGstInclusive, pricing: r.defaultPricing,
  }));
  let res: Response;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description, priceBook }),
    });
  } catch {
    throw new Error('Could not reach the quote server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error((data && data.error) || `AI error ${res.status}`);
  return toScopes(parseJson((data && data.text) || ''));
}
