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
  'The app computes final sell prices, GST, margins AND the 7% fuel levy from your inputs —',
  'do NOT compute sell prices, GST or the fuel levy yourself. Enter BASE costs only.',
  'Use the PRICE BOOK provided for costs and default pricing. If an item is not in it, estimate and say so in the description.',
  '',
  'Rules:',
  '- Money is in CENTS (integers): $102.00 = 10200.',
  '- Units: m2, m3, lineal_m, each, hour, load, flat.',
  '- Convert measurements to quantities: area = L×W (m2); volume = area×depth (m3).',
  '  Add ~10% wastage to bulk material VOLUMES (chip, bark, soil, aggregate) and note it in the description.',
  '  Default bark/mulch depth 50mm (0.05 m) when not stated; chip/aggregate use the depth given.',
  '- HANDLING: for every bulk material supplied, add a LABOUR line to move/spread it at 1 hr per m3.',
  '- LABOUR: type "labour", unit "hour", costRateCents 3700 ($37/hr cost),',
  '  pricing {"method":"charge","sellRateCents":6500} — labour is charged at the standard $65/hr.',
  '- MATERIALS bought & carted (bark, chip, soil, stone, AP20, timber, pavers, weedmat, plants):',
  '  pricing {"method":"margin","rate":R} on the price-book cost. R = item default, else 0.40;',
  '  loose bulk (bark/chip/soil) often 0.30. Enter BASE cost — the app adds the fuel levy itself.',
  '- FUEL LEVY is by supplier: 7% applies to landscaping-YARD materials (CLS, Garden Box, Dyers Road, Mainscape).',
  '  QUARRY aggregate (AP20/AP40/GAP/basecourse/crusher dust) is EXEMPT — set "supplier":"Frews" on those lines.',
  '- FIXED-RATE items (ready lawn, hydroseed, deck staining $32/m², timber edging $33.33/lm, turf,',
  '  waterblast $4.50/m², house wash, retaining $280/lm, lawn prep): pricing {"method":"charge","sellRateCents":X} from the price book.',
  '- GST: costRateGstInclusive true ONLY if the price book marks the item GST-inclusive (CLS wholesale = false; Bunnings/retail = true).',
  '- CARTAGE — work it out PER bulk material (each product is carted separately):',
  '    volume > 2 m3 → add ONE "Delivery" line {"type":"other","pricing":{"method":"margin","rate":0.40},"costRateCents":7565} ($75.65 flat, NOT per m3).',
  '    volume <= 2 m3 → WE collect: add a 1-hour labour line PLUS a "$15 diesel" line {"type":"other","pricing":{"method":"margin","rate":0.40},"costRateCents":1500}.',
  '    Two different products that each need carting = two separate cartage entries (e.g. 3 m3 chip + 5 m3 bark = 2 deliveries).',
  '- Aim for ~40% BLENDED margin across the quote (labour & fixed items run higher; loose bulk a bit lower).',
  '- Keep scopes SEPARATE — one scope per distinct area/job mentioned. Never merge them.',
  '- State assumptions briefly in the line description rather than asking questions.',
  '',
  'Return STRICT JSON only (no markdown), shape:',
  '{"scopes":[{"title":string,"description":string,"lines":[{"type":"material|labour|other","description":string,"unit":string,"quantity":number,"costRateCents":integer,"costRateGstInclusive":boolean,"supplier":string(optional, e.g. "Frews" for quarry aggregate),"pricing":{"method":"margin","rate":number}|{"method":"charge","sellRateCents":integer}|{"method":"passthrough"}}]}]}',
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
      // 16k keeps a non-streaming browser request under HTTP timeouts while giving
      // big multi-scope jobs room (Sonnet 4.6 allows up to 64k, but that needs streaming).
      model: MODEL, max_tokens: 16000, system: SYSTEM,
      messages: [{ role: 'user', content: `PRICE BOOK (JSON):\n${JSON.stringify(priceBook)}\n\nJOB DESCRIPTION:\n${description}\n\nReturn the JSON now.` }],
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // The response ran out of room — the JSON is cut off and won't parse. Say so plainly.
  if (data.stop_reason === 'max_tokens') {
    throw new Error('That job was too big to generate in one go. Try describing one area at a time, or split it into a couple of smaller goes.');
  }
  const text = (data.content || []).map((c: any) => c.text || '').join('');
  if (!text.trim()) {
    throw new Error(`The AI returned no text (stop reason: ${data.stop_reason || 'unknown'}). Try rewording, or check your API credit.`);
  }
  return toScopes(parseJson(text));
}
