/**
 * Rapid Refresh — Invoice → Price Book pipeline (Google Apps Script).
 *
 * Runs in Harvey's Google account. Every 15 min it:
 *   1. finds emails in the "Invoices" label not yet "invoice-processed" that have a PDF,
 *   2. sends each PDF to Claude to extract supplier + line items + unit prices,
 *   3. writes them to the "Pending" tab (hold-for-approval),
 *   4. labels the email "invoice-processed" so it's never handled twice.
 * You then tick "Approve" rows and run "Apply approved → Price Book".
 *
 * SETUP (one time):
 *   1. In the spreadsheet: Extensions → Apps Script. Paste this file. Save.
 *   2. Project Settings (gear) → Script properties → Add property:
 *        name:  ANTHROPIC_API_KEY    value: <your sk-ant-... key>
 *   3. Back in the editor, run setup() once → authorise when prompted.
 *   4. Done. The 🧾 Invoices menu appears in the sheet; the timer is running.
 */

const MODEL = 'claude-haiku-4-5-20251001';   // cheap + supports PDF/image reading
const SRC_LABEL = 'Invoices';
const DONE_LABEL = 'invoice-processed';
const MAX_THREADS_PER_RUN = 25;              // safety cap per execution
const TIME_BUDGET_MS = 270000;               // stop ~4.5 min in (Apps Script limit is 6 min)

const PROMPT = [
  'You are reading a supplier invoice PDF for a New Zealand landscaping business.',
  'Extract the data as STRICT JSON only (no prose, no markdown fences). Shape:',
  '{',
  '  "supplier": string,',
  '  "invoiceNumber": string,',
  '  "invoiceDate": "YYYY-MM-DD" or "",',
  '  "items": [',
  '    {',
  '      "item": string,            // product description as printed',
  '      "unit": string,            // e.g. m3, m2, lineal m, each, bag, tonne, load, hour — best guess',
  '      "qty": number,',
  '      "unitPrice": number,       // price per unit as printed',
  '      "gstInclusive": boolean,   // true if the printed unit price already includes GST',
  '      "lineTotal": number',
  '    }',
  '  ]',
  '}',
  'Rules: numbers only (no "$" or commas). If the invoice lists prices ex-GST with GST added',
  'as a separate total, set gstInclusive=false. Skip pure freight/rounding lines only if they',
  'have no product. If a field is unknown use "" or 0. Return ONLY the JSON object.',
].join('\n');

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🧾 Invoices')
    .addItem('Refresh price book (curated)', 'refreshPriceBook')
    .addItem('Process now', 'processInvoices')
    .addItem('Apply approved → Price Book', 'applyApproved')
    .addItem('Apply ALL pending → Price Book', 'applyAllPending')
    .addSeparator()
    .addItem('Set up (run once)', 'setup')
    .addToUi();
}

// Curated from real invoices (latest ex-GST cost, deduped). Cols: item,unit,cost,gst,margin,supplier,_,src
// Margin 0 = pass-through at cost (hire/disposal/delivery). Editable — your margin edits are kept on refresh.
const PRICEBOOK = [
  ['19mm Drainage Chip', 'm3', 102, 'ex-GST', 30, 'Canterbury Landscape', '', 'curated'],
  ['Premium Brown Chip', 'm3', 91, 'ex-GST', 30, 'Canterbury Landscape', '', 'curated'],
  ['Arbor Mulch', 'm3', 26, 'ex-GST', 30, 'Canterbury Landscape', '', 'curated'],
  ['15mm Waipapa White Chip', 'scoop', 49.17, 'ex-GST', 30, 'Canterbury Landscape', '', 'curated'],
  ['White Ice Lime 20mm', 'scoop', 65.84, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['White Ice Lime 15mm', 'scoop', 65.84, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Arctic White / Waituna 15-20mm', 'scoop', 107.39, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Black Satin Chip', 'scoop', 43.59, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Grade 4 Chip 12mm', 'scoop', 28.91, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Topcourse AP20', 'scoop', 26.33, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Crusher Dust AP5', 'scoop', 31.68, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Garden Soil (Planting Mix)', 'scoop', 23.20, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Garden Grow Compost', 'scoop', 27.16, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Vita Blend Organic Compost', 'scoop', 44.32, 'ex-GST', 30, 'Garden Box', '', 'curated'],
  ['Paver Carbon/Bluestone 900x450x40', 'each', 37.17, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['SmartPave White Panel 1144x806x32', 'each', 39.09, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['Steptread Porcelain Charcoal Nosing', 'each', 5.00, 'ex-GST', 40, 'Tilemax', '', 'curated'],
  ['Weedmat Non Woven 60gsm 1x25m', 'roll', 18.96, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['Weedmat Pins 130mm (Box 200)', 'box', 35.11, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['Weedsafe Pro Weedmat 1x25m', 'each', 24.78, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['Glyphosate 360 Weedkiller 1L', 'litre', 18.59, 'ex-GST', 40, 'Garden Box', '', 'curated'],
  ['Lomandra Lime Tuff 1L', 'each', 12.49, 'ex-GST', 35, 'Big Little Tree', '', 'curated'],
  ['Prunus lusitanica Std PB28', 'each', 121.74, 'ex-GST', 35, 'Big Little Tree', '', 'curated'],
  ["Nandina 'Firepower'", 'each', 8.95, 'ex-GST', 35, 'Elliotts', '', 'curated'],
  ['Ophiopogon Black Dragon', 'each', 7.50, 'ex-GST', 35, 'Elliotts', '', 'curated'],
  ['Ophiopogon Japonica', 'each', 7.50, 'ex-GST', 35, 'Elliotts', '', 'curated'],
  ['Boxing Timber', 'lineal m', 12, 'ex-GST', 40, '', '', 'curated'],
  ['Corten Steel Boxing', 'lineal m', 45, 'ex-GST', 40, '', '', 'curated'],
  ['Stone Supply', 'm3', 160, 'ex-GST', 30, '', '', 'curated'],
  ['Artificial Turf', 'm2', 56, 'ex-GST', 40, '', '', 'curated'],
  ['Labour', 'hour', 37, 'ex-GST', 40, '', '', 'curated'],
  ['Greenwaste Dump', 'tonne', 195, 'ex-GST', 0, 'Frews / CLS', '', 'curated'],
  ['Mixed C/Waste Dump', 'tonne', 291, 'ex-GST', 0, 'Frews', '', 'curated'],
  ['Compactor Plate Hire (full day)', 'day', 74.35, 'ex-GST', 0, 'Garden Box', '', 'curated'],
  ['Compactor Plate Hire (half day)', 'each', 49.57, 'ex-GST', 0, 'Garden Box', '', 'curated'],
  ['Trailer Hire (per hour)', 'hour', 4.35, 'ex-GST', 0, 'Garden Box', '', 'curated'],
  ['Delivery — Garden Box (1-2m3)', 'load', 42.17, 'ex-GST', 0, 'Garden Box', '', 'curated'],
  ['Delivery — Canterbury Landscape Zone 2', 'load', 75.65, 'ex-GST', 0, 'Canterbury Landscape', '', 'curated'],
];

function seedPriceBook_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('PriceBook');
  if (sh.getLastRow() >= 2) return; // already has rows — don't clobber
  sh.getRange(2, 1, PRICEBOOK.length, PRICEBOOK[0].length).setValues(PRICEBOOK);
}

// One-click: (re)load the curated price book, keeping any Margin % you've edited by item name.
function refreshPriceBook() {
  var sh = SpreadsheetApp.getActive().getSheetByName('PriceBook');
  var margins = {};
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (r[0]) margins[String(r[0]).toLowerCase().trim()] = r[4];
    });
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }
  var rows = PRICEBOOK.map(function (r) {
    var key = String(r[0]).toLowerCase().trim();
    var m = (margins[key] !== undefined && margins[key] !== '') ? margins[key] : r[4];
    return [r[0], r[1], r[2], r[3], m, r[5], new Date(), r[7]];
  });
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.getActive().toast(rows.length + ' items loaded into the Price Book.', 'Rapid Refresh', 6);
}

// Future invoices: apply EVERY pending row (skipping obvious non-materials) without ticking each.
var SKIP_RE = /faf|delivery|freight|green ?waste|dump|hire|trailer|compactor|xero|drinks|credit note|invoice #|p\/o|loading ramp|window|house wash|water blast/i;
function applyAllPending() {
  var ss = SpreadsheetApp.getActive();
  var pending = ss.getSheetByName('Pending');
  var book = ss.getSheetByName('PriceBook');
  if (pending.getLastRow() < 2) { ss.toast('Nothing pending.'); return; }
  var data = pending.getRange(2, 1, pending.getLastRow() - 1, 13).getValues();
  var bookRows = {};
  if (book.getLastRow() >= 2) {
    book.getRange(2, 1, book.getLastRow() - 1, 1).getValues().forEach(function (r, i) { if (r[0]) bookRows[String(r[0]).toLowerCase().trim()] = i + 2; });
  }
  var applied = 0;
  for (var i = 0; i < data.length; i++) {
    var row = data[i], item = row[4], unit = row[5], qty = Number(row[6]), price = Number(row[7]);
    if (!item || !String(item).trim() || qty <= 0 || price <= 0 || SKIP_RE.test(String(item))) continue;
    var priceEx = (row[8] === 'incl') ? Math.round(price / 1.15 * 100) / 100 : price;
    var keyName = String(item).toLowerCase().trim();
    var rec = [item, unit, priceEx, 'ex-GST', 30, row[1], new Date(), row[2]];
    if (bookRows[keyName]) { rec[4] = book.getRange(bookRows[keyName], 5).getValue(); book.getRange(bookRows[keyName], 1, 1, 8).setValues([rec]); }
    else { book.appendRow(rec); bookRows[keyName] = book.getLastRow(); }
    applied++;
  }
  ss.toast(applied + ' price(s) applied from pending.', 'Rapid Refresh', 6);
}

function setup() {
  ensureSheets_();
  seedPriceBook_();
  const exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processInvoices'; });
  if (!exists) ScriptApp.newTrigger('processInvoices').timeBased().everyMinutes(15).create();
  getOrCreateLabel_(DONE_LABEL);
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  SpreadsheetApp.getActive().toast(key ? 'Setup complete — running every 15 min.' : 'Setup done, but ANTHROPIC_API_KEY is not set yet (Project Settings → Script properties).', 'Rapid Refresh', 8);
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActive();
  mkSheet_(ss, 'Pending', ['When', 'Supplier', 'Invoice #', 'Inv date', 'Item', 'Unit', 'Qty', 'Unit price', 'GST incl?', 'Line total', 'Current book price', 'Approve', 'Source']);
  mkSheet_(ss, 'PriceBook', ['Item', 'Unit', 'Cost $/unit (ex GST)', 'GST treatment', 'Margin %', 'Supplier', 'Last updated', 'Source invoice']);
  mkSheet_(ss, 'Log', ['When', 'Message']);
}

function mkSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function processInvoices() {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) { log_('No ANTHROPIC_API_KEY set — add it in Project Settings → Script properties.'); return; }
  ensureSheets_();
  var done = getOrCreateLabel_(DONE_LABEL);
  var start = Date.now();
  var threads = GmailApp.search('label:' + SRC_LABEL + ' -label:' + DONE_LABEL, 0, MAX_THREADS_PER_RUN);
  var processed = 0, withPrices = 0;
  for (var i = 0; i < threads.length; i++) {
    if (Date.now() - start > TIME_BUDGET_MS) break; // leave room before the 6-min cap
    var thread = threads[i];
    try {
      var hadError = false, sawDoc = false;
      var msgs = thread.getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var atts = msgs[m].getAttachments();
        for (var a = 0; a < atts.length; a++) {
          var ct = atts[a].getContentType();
          if (ct !== 'application/pdf' && ct.indexOf('image/') !== 0) continue;
          sawDoc = true;
          var data = extractInvoice_(key, atts[a], ct);
          if (data === null) { hadError = true; }
          else if (data.items && data.items.length) { writePending_(data, thread.getId()); withPrices++; }
        }
      }
      // Label done unless a transient API error occurred (so statements/promos aren't retried,
      // but genuine failures get another go next run).
      if (!hadError) { thread.addLabel(done); processed++; }
    } catch (e) {
      log_('Thread ' + thread.getId() + ' error: ' + e);
    }
  }
  log_('Run: ' + processed + ' threads cleared, ' + withPrices + ' invoice(s) with prices added.');
}

function extractInvoice_(key, attachment, contentType) {
  var b64 = Utilities.base64Encode(attachment.getBytes());
  var block = (contentType === 'application/pdf')
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: contentType, data: b64 } };
  var payload = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    log_('Claude API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 400));
    return null;
  }
  var body = JSON.parse(res.getContentText());
  var text = (body.content || []).map(function (c) { return c.text || ''; }).join('');
  return parseJson_(text);
}

function parseJson_(text) {
  var t = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); }
  catch (e) {
    var s = t.indexOf('{'), e2 = t.lastIndexOf('}');
    if (s >= 0 && e2 > s) { try { return JSON.parse(t.slice(s, e2 + 1)); } catch (e3) {} }
    log_('Could not parse JSON from model: ' + t.slice(0, 200));
    return null;
  }
}

function writePending_(data, threadId) {
  var ss = SpreadsheetApp.getActive();
  var pending = ss.getSheetByName('Pending');
  var book = bookIndex_(ss);
  var url = 'https://mail.google.com/mail/u/0/#all/' + threadId;
  var rows = data.items.map(function (it) {
    var keyName = String(it.item || '').toLowerCase().trim();
    return [
      new Date(),
      data.supplier || '',
      data.invoiceNumber || '',
      data.invoiceDate || '',
      it.item || '',
      it.unit || '',
      Number(it.qty) || 0,
      Number(it.unitPrice) || 0,
      it.gstInclusive ? 'incl' : 'excl',
      Number(it.lineTotal) || 0,
      book[keyName] != null ? book[keyName] : '',
      false, // Approve checkbox
      url,
    ];
  });
  if (!rows.length) return;
  var start = pending.getLastRow() + 1;
  pending.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  pending.getRange(start, 12, rows.length, 1).insertCheckboxes(); // Approve column (audit trail)
  autoApplyToBook_(ss, data); // also push straight into the Price Book — fully automatic
}

// Upsert an invoice's material lines into the Price Book (latest price wins; junk skipped; margins kept).
function autoApplyToBook_(ss, data) {
  var book = ss.getSheetByName('PriceBook');
  var idx = {};
  if (book.getLastRow() >= 2) {
    book.getRange(2, 1, book.getLastRow() - 1, 1).getValues().forEach(function (r, i) { if (r[0]) idx[String(r[0]).toLowerCase().trim()] = i + 2; });
  }
  (data.items || []).forEach(function (it) {
    var item = String(it.item || '').trim();
    var qty = Number(it.qty), price = Number(it.unitPrice);
    if (!item || qty <= 0 || price <= 0 || SKIP_RE.test(item)) return;
    var priceEx = it.gstInclusive ? Math.round(price / 1.15 * 100) / 100 : price;
    var key = item.toLowerCase();
    var rec = [item, it.unit || '', priceEx, 'ex-GST', 30, data.supplier || '', new Date(), data.invoiceNumber || ''];
    if (idx[key]) { rec[4] = book.getRange(idx[key], 5).getValue(); book.getRange(idx[key], 1, 1, 8).setValues([rec]); }
    else { book.appendRow(rec); idx[key] = book.getLastRow(); }
  });
}

function bookIndex_(ss) {
  var sh = ss.getSheetByName('PriceBook');
  var idx = {};
  if (sh.getLastRow() < 2) return idx;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues(); // Item, Unit, Cost
  vals.forEach(function (r) { if (r[0]) idx[String(r[0]).toLowerCase().trim()] = r[2]; });
  return idx;
}

function applyApproved() {
  var ss = SpreadsheetApp.getActive();
  var pending = ss.getSheetByName('Pending');
  var book = ss.getSheetByName('PriceBook');
  if (pending.getLastRow() < 2) { ss.toast('Nothing pending.'); return; }
  var data = pending.getRange(2, 1, pending.getLastRow() - 1, 13).getValues();

  // index existing price-book rows by item name
  var bookRows = {};
  if (book.getLastRow() >= 2) {
    var bv = book.getRange(2, 1, book.getLastRow() - 1, 1).getValues();
    bv.forEach(function (r, i) { if (r[0]) bookRows[String(r[0]).toLowerCase().trim()] = i + 2; });
  }

  var applied = 0;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[11] !== true) continue; // Approve not ticked
    var item = row[4], unit = row[5];
    var priceExGst = (row[8] === 'incl') ? round2_(Number(row[7]) / 1.15) : Number(row[7]);
    var keyName = String(item).toLowerCase().trim();
    var rec = [item, unit, priceExGst, 'ex-GST', '', row[1], new Date(), row[2]];
    if (bookRows[keyName]) {
      // preserve existing margin % (col 5)
      var existingMargin = book.getRange(bookRows[keyName], 5).getValue();
      rec[4] = existingMargin;
      book.getRange(bookRows[keyName], 1, 1, 8).setValues([rec]);
    } else {
      book.appendRow(rec);
      bookRows[keyName] = book.getLastRow();
    }
    pending.getRange(i + 2, 12).setValue(false); // untick
    pending.getRange(i + 2, 5).setNote('Applied ' + new Date().toLocaleString());
    applied++;
  }
  ss.toast(applied + ' price(s) applied to the Price Book.', 'Rapid Refresh', 6);
}

function round2_(n) { return Math.round(n * 100) / 100; }

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function log_(msg) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('Log') || SpreadsheetApp.getActive().insertSheet('Log');
    sh.appendRow([new Date(), msg]);
  } catch (e) { /* noop */ }
}
