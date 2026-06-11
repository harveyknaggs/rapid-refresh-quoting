# Morning summary — overnight refinements

Branch: **`overnight-refinements`** (your `main` and live app are untouched). Everything below is
committed in small steps; review the diff and keep/bin as you like. **All 36 package tests pass and
`npm run build` is green** at every commit.

## What I did (in order)

1. **Checkpoint** — real rate book wired in: rate card seeded with CLS wholesale costs + sell rates from
   87 past quotes; fuel levy made +7% on ALL materials (engine); labour charged $65/hr (cost $37 → ~43%);
   "Describe the job" AI updated to use the rates and let the engine add levy/GST/margins. New data files
   `RATES.md` + `suppliers-CLS.md`.
2. **Line form** — made cost-vs-sell explicit ("what you PAY" vs "what you CHARGE" + per-method helper).
   Also **fixed a real bug**: rate-card bark items were baking the 7% levy into cost AND the engine
   re-applied it → double levy. Engine is now the single source; preview mirrors it.
3. **Editor** — fixed-rate lines now show true margin, or "cost not set" instead of a misleading 100%.
4. **Tests** — locked the new rules: +7% material levy via priceScope (not labour/other); $65 labour charge.
5. **README** — pricing-rules section rewritten to match (labour $65, 7% on all materials, ~40% blended
   target, CLS ex-GST vs retail incl, 50mm bark depth, +10% wastage, 1 hr/m³ handling, delivery per load).
6. **Margin bar** — shows profit $ under the blended %, with an "under 35%" cue.
7. **Multi-supplier** — additive foundation (`SupplierCost`, `RateCardItem.suppliers?`, `LineItem.supplier?`,
   `resolveSupplierCost`, `defaultSupplierFor` = pavers→Garden Box else CLS, `suppliersFor`) + tests, plus a
   **supplier picker in the line form** (appears when an item has >1 supplier; inert until Garden Box is added).
8. **Garden Box DRAFT** — `suppliers-GARDENBOX.md` (UNVERIFIED). Confirmed Garden Box is your aggregate/paver
   supplier (invoice GB-229273 $88.78 = the AP20 line in 35 Breens Rd). Captured website retail prices for
   aggregates + pavers. **Estimated trade discount ~17%** from one solid match (Charcoal 500×500 paver:
   retail $18.50 vs your costed $15.28).

## Decisions I need from you (couldn't decide these myself)

1. **Deck staining** — is $32/m² the **sell** or the **cost**? (Your past chats do it both ways.) I set it as sell.
2. **AP20 base** — $80 or $90/m³? (Aggregate isn't on CLS's list = retail − 10%; Garden Box AP20 was out of stock.)
3. **Fuel levy 7%** — confirm it's 7% on **all** materials (I built it that way per your note).
4. **Garden Box trade discount %** — confirm ~17% (better: derive per-category from invoice line items).
5. **Garden Box GST** — website/invoice prices look GST-inclusive; confirm so I mark the cost ÷1.15.
6. **Default supplier mapping** — pavers → Garden Box, everything else → CLS. Confirm.
7. **More supplier lists** — want me to pull Garden Box bark/soil/weedmat/edging too, or add other suppliers?

## Also on this branch for your review (earlier exploratory work)
- **Client & property capture** (name/phone/email/site-notes on a quote) — we paused on whether quoting
  should own this vs the future CRM. It's here if you want it.
- **Delete quote** button (with confirm).
- **Passcode gate disabled** in `main.tsx` for local dev — re-enable before any public redeploy.

## How to use it
`git checkout overnight-refinements` then `npm run dev`. To keep it: merge to `main` when happy
(`git checkout main && git merge overnight-refinements`). Nothing was pushed or deployed.
