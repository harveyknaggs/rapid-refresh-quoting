// "Describe the job → auto-filled, priced line items." Calls Claude directly from the browser
// using the user's own key (stored on this device only). The app's pricing engine does the final
// maths — the model only produces line INPUTS.

import { ulid, type RateCardItem, type Scope, type LineItem, type Pricing, type Unit, type LineType } from '@rapid-refresh/domain';

const KEY = 'rr.anthropicKey';
export const getAnthropicKey = (): string => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setAnthropicKey = (k: string): void => { try { localStorage.setItem(KEY, k.trim()); } catch { /* */ } };

const MODEL = 'claude-sonnet-4-6';

const SYSTEM = [
  'You generate quote line-item INPUTS for a New Zealand landscaping business (Rapid Refresh).',
  'The app computes final sell prices from your inputs — do NOT compute sell prices yourself.',
  'Use the PRICE BOOK provided for costs and default pricing. If an item is not in it, estimate and say so in the description.',
  '',
  'Rules:',
  '- Money is in CENTS (integers): $102.00 = 10200.',
  '- Units: m2, m3, lineal_m, each, hour, load, flat.',
  '- Convert measurements to quantities: area = L×W (m2); volume = area×depth (m3).',
  '  Add ~10% wastage to bulk material VOLUMES (chip, bark, soil, aggregate) and note it in the description.',
  '- Labour: type "labour", unit "hour", costRateCents ≈ 3700, pricing {"method":"margin","rate":0.40}. Never charge $65 directly.',
  '- Materials: pricing {"method":"margin","rate":R} using the price-book default (else 0.40; bulk materials often 0.30).',
  '- Fixed sell-rate items (turf sell, deck staining, lawn): pricing {"method":"charge","sellRateCents":X}.',
  '- GST: set costRateGstInclusive true ONLY if the price book marks that item GST-inclusive.',
  '- Delivery: if a bulk material needs carting, add a separate "other" line "Delivery (N loads)".',
  '  Bark trailer = 2 m3/load; AP20/aggregate ≈ 0.667 m3/load; $6000 cents per load.',
  '- Keep scopes SEPARATE — one scope per distinct area/job mentioned. Never merge them.',
  '- State assumptions briefly in the line description rather than asking questions.',
  '',
  'Return STRICT JSON only (no markdown), shape:',
  '{"scopes":[{"title":string,"description":string,"lines":[{"type":"material|labour|other","description":string,"unit":string,"quantity":number,"costRateCents":integer,"costRateGstInclusive":boolean,"pricing":{"method":"margin","rate":number}|{"method":"charge","sellRateCents":integer}|{"method":"passthrough"}}]}]}',
].join('\n');

const UNITS: Unit[] = ['m2', 'm3', 'lineal_m', 'each', 'hour', 'load', 'flat'];
const normUnit = (u: string): Unit => (UNITS.indexOf(u as Unit) >= 0 ? u as Unit : 'each');
const normType = (t: string): LineType => (t === 'labour' || t === 'other' ? t : 'material');
function normPricing(p: any): Pricing {
  if (p && p.method === 'charge') return { method: 'charge', sellRateCents: Math.round(Number(p.sellRateCents) || 0) };
  if (p && p.method === 'passthrough') return { method: 'passthrough' };
  return { method: 'margin', rate: Number(p && p.rate) || 0.40 };
}

function parseJson(text: string): any {
  const t = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch {
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error('Could not read the AI response.');
  }
}

function toScopes(parsed: any): Scope[] {
  const arr = (parsed && parsed.scopes) || [];
  return arr.map((s: any, si: number): Scope => ({
    id: ulid(), title: s.title || 'Scope', description: s.description || '', order: si,
    lines: ((s.lines) || []).map((l: any, li: number): LineItem => ({
      id: ulid(), type: normType(l.type), description: l.description || '', unit: normUnit(l.unit),
      quantity: Number(l.quantity) || 0, costRateCents: Math.round(Number(l.costRateCents) || 0),
      costRateGstInclusive: !!l.costRateGstInclusive, pricing: normPricing(l.pricing),
      rateCardItemId: null, order: li,
    })),
  }));
}

export async function generateScopes(description: string, rateCard: RateCardItem[]): Promise<Scope[]> {
  const key = getAnthropicKey();
  if (!key) throw new Error('No API key set yet — add it in ⚙ Settings.');
  const priceBook = rateCard.map((r) => ({
    item: r.label, unit: r.unit, costCents: r.costRateCents,
    gstInclusive: r.costRateGstInclusive, pricing: r.defaultPricing,
  }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 4000, system: SYSTEM,
      messages: [{ role: 'user', content: `PRICE BOOK (JSON):\n${JSON.stringify(priceBook)}\n\nJOB DESCRIPTION:\n${description}\n\nReturn the JSON now.` }],
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map((c: any) => c.text || '').join('');
  return toScopes(parseJson(text));
}
