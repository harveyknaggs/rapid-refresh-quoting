// Production server for the quoting app.
// Serves the built static files AND proxies the "Describe the job" AI call so the
// Anthropic key lives on the server (in ANTHROPIC_API_KEY) instead of in each
// user's browser. Roy never needs to paste a key.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = process.env.PORT || 8000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Same instructions the app used when it called Claude directly from the browser.
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
  '- HANDLING LABOUR (per m3 of material): moving material OUT (dig out + cart to the dump) = 2 hr/m3; moving material IN (bring in + spread/lay) = 1 hr/m3. Add labour lines accordingly.',
  '- LABOUR: type "labour", unit "hour", costRateCents 3700 ($37/hr cost),',
  '  pricing {"method":"charge","sellRateCents":6500} — labour is charged at the standard $65/hr.',
  '- MATERIALS bought & carted (bark, chip, soil, stone, AP20, timber, pavers, weedmat, plants):',
  '  pricing {"method":"margin","rate":R} on the price-book cost. R = item default, else 0.40;',
  '  loose bulk (bark/chip/soil) often 0.30. Enter BASE cost — the app adds the fuel levy itself.',
  '- FUEL LEVY is by supplier: 7% applies to landscaping-YARD materials (CLS, Garden Box, Dyers Road, Mainscape).',
  '  QUARRY aggregate (AP20/AP40/GAP/basecourse/crusher dust) is EXEMPT — set "supplier":"Frews" on those lines.',
  '- FIXED-RATE items (ready lawn, hydroseed, deck staining $32/m², timber edging $33.33/lm, turf,',
  '  waterblast $4.50/m², house wash, retaining $280/lm, lawn prep, paving prep $65/m²): pricing {"method":"charge","sellRateCents":X} from the price book.',
  '- PAVING = three lines: (1) "Paving prep" charge $65/m2 (dig out 100mm + 100mm AP20 base, compacted);',
  '  (2) the pavers as a material line at cost+margin; (3) labour to lay the pavers. Paving prep already covers the dig-out/AP20/dump/handling — do NOT add those again.',
  '  OPTIONAL: if edging is needed, add timber edging/boxing at $33.33/lm (charge) down the sides (e.g. both long edges of the patio).',
  '- GST: costRateGstInclusive true ONLY if the price book marks the item GST-inclusive (CLS wholesale = false; Bunnings/retail = true).',
  '- CARTAGE — work it out PER bulk material (each product is carted separately):',
  '    volume > 2 m3 → add ONE "Delivery" line {"type":"other","pricing":{"method":"margin","rate":0.40},"costRateCents":7565} ($75.65 flat, NOT per m3).',
  '    volume <= 2 m3 → WE collect: add a 1-hour labour line PLUS a "$15 diesel" line {"type":"other","pricing":{"method":"margin","rate":0.40},"costRateCents":1500}.',
  '    Two different products that each need carting = two separate cartage entries (e.g. 3 m3 chip + 5 m3 bark = 2 deliveries).',
  '    TIMBER is separate: when timber/boxing is used, add ONE "Timber cartage" line $65/job {"type":"other","pricing":{"method":"margin","rate":0.40},"costRateCents":6500} — not the bulk-material rule above.',
  '- Aim for ~40% BLENDED margin across the quote (labour & fixed items run higher; loose bulk a bit lower).',
  '- Keep scopes SEPARATE — one scope per distinct area/job mentioned. Never merge them.',
  '- State assumptions briefly in the line description rather than asking questions.',
  '',
  'Return STRICT JSON only (no markdown), shape:',
  '{"scopes":[{"title":string,"description":string,"lines":[{"type":"material|labour|other","description":string,"unit":string,"quantity":number,"costRateCents":integer,"costRateGstInclusive":boolean,"supplier":string(optional, e.g. "Frews" for quarry aggregate),"pricing":{"method":"margin","rate":number}|{"method":"charge","sellRateCents":integer}|{"method":"passthrough"}}]}]}',
].join('\n');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/generate', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server is not configured yet (missing ANTHROPIC_API_KEY).' });
    }
    const { description, priceBook } = req.body || {};
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'No job description provided.' });
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `PRICE BOOK (JSON):\n${JSON.stringify(priceBook || [])}\n\nJOB DESCRIPTION:\n${description}\n\nReturn the JSON now.`,
        }],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: `AI error ${r.status}: ${t.slice(0, 200)}` });
    }
    const data = await r.json();
    if (data.stop_reason === 'max_tokens') {
      return res.status(422).json({ error: 'That job was too big to generate in one go. Try describing one area at a time, or split it into a couple of smaller goes.' });
    }
    const text = (data.content || []).map((c) => c.text || '').join('');
    if (!text.trim()) {
      return res.status(502).json({ error: `The AI returned no text (stop reason: ${data.stop_reason || 'unknown'}). Try rewording, or check the API credit.` });
    }
    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Server error' });
  }
});

// Static files + SPA fallback (any non-API GET returns index.html).
app.use(express.static(DIST));
app.use((req, res) => res.sendFile(path.join(DIST, 'index.html')));

app.listen(PORT, () => console.log(`Quoting app listening on :${PORT}`));
