# Rapid Refresh — Quoting Module

A quoting module within the wider Rapid Refresh business ecosystem (clients, properties, jobs,
invoicing, crew). Data-model-first; shared entities are referenced by id, never duplicated.
All pricing math lives in one reusable, framework-agnostic layer.

## Repo layout
```
packages/
  pricing/        Pure pricing calculation layer (no framework, no IO). ← Milestone 1 (done)
    src/          money.ts · rates.ts · quote.ts · index.ts
    test/         money/rates/quote tests — Node built-in runner
  domain/         (next) Quote/Scope/LineItem schema as shared types
  data/           (next) QuoteRepository interface + adapters (IndexedDB first, REST later)
apps/
  quoting/        (next) React + Vite + Tailwind PWA, mobile-first, offline-tolerant
```

## Run the pricing tests
No install needed — uses Node's built-in test runner + native TypeScript (Node ≥ 23.6 / using 24).
```
cd packages/pricing
npm test          # → node --test test/*.test.ts
```

## Pricing rules (the contract — documented so quoting/invoicing/reporting compute identically)

- **Money is integer cents** everywhere. Quantities stay decimal (m², m³).
- **Target is ~40% BLENDED margin across the whole quote**, not 40% forced on every line. 40% is the
  target/floor; labour & fixed-rate items run higher, loose materials can sit a little lower.
- **TRUE MARGIN, never markup.** `sell = cost / (1 − margin)`. 40% → ÷0.60, 35% → ÷0.65, 30% → ÷0.70.
- **Margin always applies to COST**, never to a sell rate.
  - Materials: `margin` method on the cost (loose bulk often 0.30).
  - **Labour: `charge` $65/hr** on a **$37/hr cost** (≈43% margin). (Earlier modelled as margin → $61.67;
    Harvey now charges the real $65.)
  - Fixed sell rates (turf $190/m², deck-stain $32/m², edging $33.33/lm, ready lawn, hydroseed, waterblast
    $4.50/m², retaining $280/lm): `charge` method, no margin stacked — but record the cost build-up so true
    margin is visible.
  - At-cost lines: `passthrough`.
- **Fuel levy: +7% on ALL material costs** (any supplier), applied by the pricing engine before margin and
  delivery — never enter it manually. (Broader than the old "bark/chip only" rule.)
- **GST = NZ 15%.** Bunnings/retail costs are GST-inclusive → `÷1.15` for true cost; **CLS wholesale is
  ex-GST** (use as-is). Sell prices are ex-GST; GST is a separate line on output.
- **Volume = area × depth.** Bark/mulch default depth **50 mm** (0.05 m) unless stated; chip/aggregate use the
  given depth. **+10% wastage** on bulk volumes. **Handling labour = 1 hr per m³** of bulk material moved.
- **Rounding:** sell rounds to the **nearest dollar at the line level** (half away from zero); scope/quote
  totals are the **sum of the already-rounded lines** (never recomputed from a combined cost). Costs round
  to the nearest cent.
- **Margin band:** per-line band 35–45% is flagged for margin-method lines (30% material allowed). Fixed-rate
  and labour-charge lines legitimately sit outside it.
- **Delivery** is a separate line per load: bark trailer 2 m³/load; aggregate/AP20 ≈ 0.67 m³/load. Loads round up.
- **Rate data** lives in `RATES.md` (rate book) and `suppliers-CLS.md` (supplier costs), refined continuously.

## Decisions flagged to become ecosystem standards
- **IDs = ULID** — globally unique, time-sortable, and mintable offline (no server round-trip on site).
  `quoteNumber` is a separate human-facing auto-increment assigned by the data layer.
- **Rate-card values are snapshotted onto a line when added** — editing the rate card never silently
  changes historical quotes or distorts actuals. The line keeps `rateCardItemId` for provenance.
- **Persistence is behind a `QuoteRepository` interface** — IndexedDB first (offline on site), REST later.
- **Versioning is non-destructive** — a root `Quote` + immutable `QuoteVersion`s; the accepted version is
  identifiable via `acceptedVersionId`.

## Status
- [x] Milestone 1 — pricing layer + tests (21 passing)
- [x] Milestone 2 — data model + persistence interface (31 passing total)
- [x] Milestone 3 — core quoting UI (multi-scope, live blended margin)
- [x] Milestone 4 — track-actuals, sensitivity, duplicate, search
- [x] Milestone 5 — client-facing quote document/export

## Run the app
```
npm install        # once, at the workspace root
npm run dev        # Vite dev server (mobile-first; open the printed URL)
npm run build      # production build → apps/quoting/dist
npm test           # all package tests (pricing/domain/data)
```
The app uses the IndexedDB adapter in the browser (offline-tolerant). New quotes mint placeholder
`clientId`/`propertyId` until the CRM/properties modules are wired in.
