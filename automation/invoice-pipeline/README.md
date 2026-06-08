# Invoice → Price Book pipeline

Automatically reads supplier invoices from Gmail and keeps the price book current. Runs as a
Google Apps Script inside Harvey's Google account (free, no server), so it can read the Gmail
**Invoices** label *and* the PDF attachments — which a normal web app can't.

## Flow
```
Supplier emails invoice → "Invoices" label
  → Apps Script (every 15 min): grab each PDF
  → Claude (claude-haiku-4-5) extracts {supplier, item, unit, unit price, GST}
  → rows land in the "Pending" tab (hold for approval)
  → email tagged "invoice-processed" (never double-handled)
You tick "Approve" → run "Apply approved → Price Book" → live prices update.
```

## Spreadsheet
**Rapid Refresh — Price Book & Invoice Inbox**
https://docs.google.com/spreadsheets/d/1wvLkz0bzi-__rXj6uNEyC85IMScXdo8TMvbYrS5H3w4/edit

Tabs (created automatically by `setup()`): **Pending** (review queue), **PriceBook** (live prices),
**Log** (processing/errors).

## One-time setup (~3 min)
1. Open the spreadsheet → **Extensions → Apps Script**.
2. Delete the placeholder, paste **Code.gs**, **Save**.
3. **Project Settings** (⚙) → **Script properties** → **Add script property**:
   `ANTHROPIC_API_KEY` = your `sk-ant-…` key.
4. Back in the editor, select **setup** in the function dropdown → **Run**. Approve the Google
   permissions prompt (Gmail + Sheets, for your own account).
5. Reload the sheet — the **🧾 Invoices** menu appears and the 15-min timer is live.

## Using it
- It runs itself. Or **🧾 Invoices → Process now** to pull immediately.
- Review the **Pending** tab, tick **Approve** on the prices you want, then
  **🧾 Invoices → Apply approved → Price Book**.
- GST: if a printed unit price is GST-inclusive it's stripped to ex-GST (÷1.15) on apply.
- Set a **Margin %** per item in PriceBook once; it's preserved on future updates.

## Notes / next
- The quoting app currently seeds its rate card in-code. **Next step** to close the loop: publish
  the PriceBook tab (Apps Script web-app JSON endpoint or published CSV) and have the app read it,
  so on-site quotes use these live prices directly.
- Statements (Xero account summaries) have no line items — only real itemised invoice PDFs yield
  prices; the rest are skipped/logged.
