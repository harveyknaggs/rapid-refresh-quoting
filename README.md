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
- **TRUE MARGIN, never markup.** `sell = cost / (1 − margin)`. 40% → ÷0.60, 35% → ÷0.65, 30% → ÷0.70.
- **Margin always applies to COST**, never to a sell rate.
  - Materials: `margin` method on the cost.
  - **Labour: `margin` on the $37/hr cost** (40% → $61.67/hr). The $65 figure is not used as an input.
  - Fixed sell rates (turf $190/m², deck-stain $32/m², lawn $65/m²): `charge` method, no margin stacked.
  - At-cost lines: `passthrough`.
- **GST = NZ 15%.** Supplier/Bunnings costs are GST-inclusive → `÷1.15` for true cost. Sell prices are
  ex-GST; GST is shown as a separate line on output.
- **Rounding:** sell rounds to the **nearest dollar at the line level** (half away from zero); scope/quote
  totals are the **sum of the already-rounded lines** (never recomputed from a combined cost). Costs round
  to the nearest cent.
- **Margin band:** quote default sits 35–45%; anything outside is flagged (per-line 30% material is allowed).
- **Fuel levy (bark/chip):** `base × (1 + 7%)` on the base **before** delivery, plus `$60 × loads`.
  Trailer = 2 m³ (6 scoops); aggregate/AP20 ≈ 0.67 m³/load (2 scoops). Loads round up.

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
- [ ] Milestone 2 — data model + persistence interface
- [ ] Milestone 3 — core quoting UI (multi-scope, live blended margin)
- [ ] Milestone 4 — track-actuals, sensitivity, duplicate, search
- [ ] Milestone 5 — client-facing quote document/export
