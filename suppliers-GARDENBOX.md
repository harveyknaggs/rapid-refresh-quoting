# Supplier price list — Garden Box (⚠ DRAFT / UNVERIFIED)

**Do NOT bake into the live rate card until Harvey confirms.** Built overnight from read-only sources:
Garden Box website retail prices + Garden Box invoices in Gmail. Prices/discount need a human check.

## Status: confirmed active supplier
- **Garden Box Limited** invoices Rapid Refresh via Xero (`invoices@rapidrefresh.co`, "Fordable
  Landscapes – Rapid Refresh"). Frequent invoices; statement ~$6,468 outstanding as at 1 Jun 2026.
- Garden Box is the **aggregate/paver** supplier — invoice **GB-229273 = $88.78** matches the
  "AP20 $88.78" line in the 35 Breens Rd quote. Fits the default mapping **pavers → Garden Box**.

## Estimated trade discount: ~15–17% off retail  ⚠ CONFIRM
- **Derived from one match:** Garden Box retail **Charcoal 500×500×30 paver = $18.50 each**; in the
  67a Aldwins quote you costed 500×500 pavers at **$15.28 each**. $15.28 ÷ $18.50 = **0.826 → ~17.4% off**.
- This is a SINGLE data point — treat as a rough estimate. The real per-category discount should be
  derived properly from invoice **line items** (the Xero emails only show totals; line items are in the
  invoice PDFs — the existing invoice pipeline can extract those). **Harvey to confirm the % (and whether
  it differs by category).**

## GST  ⚠ CONFIRM
- Website prices are a retail Shopify store → almost certainly **GST-inclusive**. The $15.28 trade figure
  and the Xero invoice totals also appear GST-inclusive. If so, Garden Box costs should be entered
  **GST-inclusive (÷1.15)** like Bunnings — confirm your trade account isn't billed ex-GST.

## Retail prices captured (website, GST-incl assumed)

### Aggregates & sand — `/collections/aggregates-sand`
Bulk "scoop" pricing (site says 1 m³ = 3 scoops — **confirm if the figure below is per m³ or per scoop**):
| Product | Price | 20L bag |
|---|---|---|
| Bedding Sand (WAP5) | $40.70 | $9.95 |
| Crusher Dust (AP5) | $38.35 | $9.95 |
| Grade 3/4/5 Chip (16/12/10mm) | $35.00 | $9.95 |
| Grey Rounds (10–14 / 13–20mm) | $32.70 | $9.95 |
| Pea Gravel (6–10mm) | $32.70 | $9.95 |
| Premix/Builders Mix | $35.65 | $9.95 |
| Boulders (65–120mm) | $38.70 | $9.95 |
*AP20 / GAP20 / GAP40 / basecourse were NOT listed (out of stock at fetch time) — get these from an invoice.*

### Pavers — `/collections/pavers` (each)
| Product | Size | Retail | Est. trade (−17%) |
|---|---|---|---|
| Feinwerk Charcoal / Carbon | 400×400×30 | $12.50 | ~$10.35 |
| Feinwerk Charcoal / Carbon | 500×500×30 | $18.50 | **$15.28 (actual)** |
| Feinwerk Charcoal / Carbon | 600×600×30 | $24.50 | ~$20.30 |
| Feinwerk rectangle | 600×300×30 | $17.50 | ~$14.50 |
| Feinwerk rectangle | 900×450×40 | $45.00 | ~$37.35 |
| Bluestone stepper | 500×400×30 | $39.95 | ~$33.16 |
| Bluestone stepper | 600×500×30 | $49.50 | ~$41.09 |
| Bluestone stepper | 700×600×30 | $54.50 | ~$45.24 |
- Accessories: PaveMaster edging 2.4m $29.50; stakes 9-pack $25.00; GeoPlus geotextile 4×5m $65.00.

## Other Garden Box categories (not yet fetched)
`bark-mulch`, `compost_soil`, `decorative-stone`, `lawn-products`, `sleepers`, `weedmat`,
`straightcure-corten-steel-edging`, `permeable-paving`, `landscape-lock-new`. Worth pulling if you
want Garden Box as an alternative to CLS on those too.

## To wire in (after Harvey confirms)
1. Confirm the trade discount % (ideally per category, from invoice line items).
2. Confirm GST basis (incl vs ex).
3. Add Garden Box entries to the relevant rate-card items' `suppliers[]` (pavers first), so the
   line-form supplier picker offers CLS vs Garden Box. Structure is already built (see suppliers.ts).
