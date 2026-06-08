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

const MODEL = 'claude-haiku-4-5-20251001';   // cheap + supports PDF reading
const SRC_LABEL = 'Invoices';
const DONE_LABEL = 'invoice-processed';
const MAX_THREADS_PER_RUN = 15;

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
    .addItem('Process now', 'processInvoices')
    .addItem('Apply approved → Price Book', 'applyApproved')
    .addSeparator()
    .addItem('Set up (run once)', 'setup')
    .addToUi();
}

function setup() {
  ensureSheets_();
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
  var threads = GmailApp.search('label:' + SRC_LABEL + ' -label:' + DONE_LABEL + ' has:attachment', 0, MAX_THREADS_PER_RUN);
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    try {
      var wroteAny = false;
      var msgs = thread.getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var atts = msgs[m].getAttachments();
        for (var a = 0; a < atts.length; a++) {
          if (atts[a].getContentType() !== 'application/pdf') continue;
          var data = extractInvoice_(key, atts[a]);
          if (data && data.items && data.items.length) { writePending_(data, thread.getId()); wroteAny = true; }
        }
      }
      if (wroteAny) { thread.addLabel(done); }
    } catch (e) {
      log_('Thread ' + thread.getId() + ' error: ' + e);
    }
  }
}

function extractInvoice_(key, attachment) {
  var b64 = Utilities.base64Encode(attachment.getBytes());
  var payload = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
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
  pending.getRange(start, 12, rows.length, 1).insertCheckboxes(); // Approve column
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
