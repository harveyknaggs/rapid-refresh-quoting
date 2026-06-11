import { useEffect, useRef, useState } from 'react';
import {
  ulid, deriveTitle, priceScope, priceQuoteVersion, seedRateCard,
  type Quote, type QuoteVersion, type QuoteStatus, type Scope, type RateCardItem, type ActualEntry,
} from '@rapid-refresh/domain';
import type { QuoteDetailsPatch } from '@rapid-refresh/data';
import { sensitivity, reconcile } from '@rapid-refresh/pricing';
import { repo } from './repo.ts';
import { loadPriceBook } from './priceBook.ts';
import { generateScopes } from './ai.ts';
import { fmt, pct, dollarsToCents } from './format.ts';
import { LineForm } from './LineForm.tsx';

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'declined', 'invoiced'];

export function QuoteEditor({ quoteId, onBack, onViewDoc, onOpen }: {
  quoteId: string;
  onBack: () => void;
  onViewDoc: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [version, setVersion] = useState<QuoteVersion | null>(null);
  const [rateCard, setRateCard] = useState<RateCardItem[]>(() => seedRateCard());
  useEffect(() => { loadPriceBook().then((items) => { if (items && items.length) setRateCard(items); }); }, []);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ scopeId: string; lineId: string } | null>(null);
  const [actuals, setActuals] = useState<ActualEntry[]>([]);
  const [actualsOpen, setActualsOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState('');
  const saveTimer = useRef<number | undefined>(undefined);

  const load = async () => {
    const q = await repo.getQuote(quoteId);
    const v = await repo.getCurrentVersion(quoteId);
    setQuote(q); setVersion(v);
    setActuals(await repo.listActuals(quoteId));
  };
  useEffect(() => { load(); }, [quoteId]);

  const commit = (v: QuoteVersion) => {
    setVersion(v);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { repo.saveVersion(v).catch(() => {}); }, 500);
  };

  if (!quote || !version) return <div className="card">Loading…</div>;

  const setScopes = (scopes: Scope[]) => commit({ ...version, scopes });
  const addScope = () => setScopes([...version.scopes, { id: ulid(), title: 'New scope', description: '', order: version.scopes.length, lines: [] }]);
  const patchScope = (id: string, patch: Partial<Scope>) => setScopes(version.scopes.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteScope = (id: string) => setScopes(version.scopes.filter((s) => s.id !== id));
  const addLine = (scopeId: string, line: any) => {
    setScopes(version.scopes.map((s) => (s.id === scopeId ? { ...s, lines: [...s.lines, { ...line, order: s.lines.length }] } : s)));
    setAddingFor(null);
  };
  const deleteLine = (scopeId: string, lineId: string) =>
    setScopes(version.scopes.map((s) => (s.id === scopeId ? { ...s, lines: s.lines.filter((l) => l.id !== lineId) } : s)));
  const replaceLine = (scopeId: string, line: any) =>
    setScopes(version.scopes.map((s) => (s.id === scopeId ? { ...s, lines: s.lines.map((x) => (x.id === line.id ? { ...line, order: x.order } : x)) } : s)));

  const changeStatus = async (status: QuoteStatus) => { await repo.setStatus(version.id, status); await load(); };
  const newVersion = async () => { await repo.newVersionFrom(quoteId); await load(); };
  const duplicate = async () => {
    const dup = await repo.duplicateAsTemplate(quoteId, { clientId: quote.clientId, propertyId: quote.propertyId, clientName: quote.clientName, address: quote.address });
    onOpen(dup.quote.id);
  };

  const generate = async () => {
    if (!desc.trim()) return;
    setGenBusy(true); setGenErr('');
    try {
      const scopes = await generateScopes(desc, rateCard);
      if (!scopes.length) setGenErr('No scopes produced — try adding more detail.');
      else { commit({ ...version, scopes: [...version.scopes, ...scopes] }); setDesc(''); }
    } catch (e: any) {
      setGenErr(String(e && e.message ? e.message : e));
    } finally { setGenBusy(false); }
  };

  const priced = priceQuoteVersion(version);
  const t = priced.total;
  const hasLines = version.scopes.some((s) => s.lines.length);
  const underTarget = hasLines && t.blendedMargin < 0.35; // under-charging is the real risk

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn secondary sm" onClick={onBack}>← Quotes</button>
          <span className={`badge ${version.status}`}>{version.status}</span>
        </div>
        <h2 style={{ marginTop: 10 }}>{deriveTitle(quote.clientName, quote.address)}</h2>
        <div className="muted small">Quote #{quote.quoteNumber} · v{version.version} · valid to {new Date(version.validUntil).toLocaleDateString('en-NZ')}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <select className="input" style={{ width: 'auto' }} value={version.status} onChange={(e) => changeStatus(e.target.value as QuoteStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn ghost sm" onClick={newVersion}>New version</button>
          <button className="btn secondary sm" onClick={duplicate}>Duplicate</button>
          <button className="btn secondary sm" onClick={() => onViewDoc(quoteId)}>Client document</button>
        </div>
      </div>

      <DetailsPanel
        quote={quote}
        onSave={async (patch) => { const updated = await repo.updateQuoteDetails(quote.id, patch); setQuote(updated); }}
      />

      <div className="card">
        <h3>✨ Describe the job</h3>
        <p className="muted small">Type it in plain English — it builds priced scopes &amp; lines you can tweak.</p>
        <textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. 766 m² of 19mm drainage chip at 40mm. Plus 80 m² hydroseed. One day digger + labour to move the chip." />
        <button className="btn block" style={{ marginTop: 8 }} disabled={genBusy || !desc.trim()} onClick={generate}>
          {genBusy ? 'Generating…' : '✨ Generate scopes'}
        </button>
        {genErr && <div className="issue">⚠ {genErr}</div>}
      </div>

      {version.scopes.map((scope) => {
        const st = priceScope(scope);
        return (
          <div className="card" key={scope.id}>
            <input className="input" style={{ fontWeight: 700, border: 'none', padding: '2px 0', fontSize: '1.05rem' }}
              value={scope.title} onChange={(e) => patchScope(scope.id, { title: e.target.value })} />
            <textarea className="input" rows={2} placeholder="Scope of work description (shown to client)"
              value={scope.description} onChange={(e) => patchScope(scope.id, { description: e.target.value })} style={{ marginTop: 6 }} />

            <div style={{ marginTop: 10 }}>
              {scope.lines.length === 0 && <div className="muted small">No lines yet.</div>}
              {scope.lines.map((l) => {
                if (editing && editing.scopeId === scope.id && editing.lineId === l.id) {
                  return (
                    <LineForm key={l.id} rateCard={rateCard} initial={l}
                      onAdd={(line) => { replaceLine(scope.id, line); setEditing(null); }}
                      onCancel={() => setEditing(null)} />
                  );
                }
                const lp = priceScope({ ...scope, lines: [l] });
                return (
                  <div className="line" key={l.id}>
                    <div className="desc" style={{ cursor: 'pointer' }} onClick={() => { setAddingFor(null); setEditing({ scopeId: scope.id, lineId: l.id }); }}>
                      <div>{l.description || '(no description)'} <span className="muted small">✎</span></div>
                      <div className="qty">{l.quantity.toFixed(2)} {l.unit} · cost {fmt(lp.costCents)} · {pct(lp.marginPct)}</div>
                    </div>
                    <div className="sell">{fmt(lp.sellCents)}</div>
                    <button className="x" title="Remove" onClick={() => deleteLine(scope.id, l.id)}>✕</button>
                  </div>
                );
              })}
            </div>

            <div className="subtotal">
              <span className="muted">Scope cost {fmt(st.costCents)}</span>
              <span><span className={`pill ${scope.lines.length && st.marginPct < 0.35 ? 'warn' : ''}`}>{pct(st.marginPct)}</span> &nbsp;<b>{fmt(st.sellCents)}</b></span>
            </div>

            {addingFor === scope.id
              ? <LineForm rateCard={rateCard} onAdd={(line) => addLine(scope.id, line)} onCancel={() => setAddingFor(null)} />
              : <button className="btn ghost block sm" style={{ marginTop: 10 }} onClick={() => setAddingFor(scope.id)}>+ Add line</button>}

            <button className="btn danger sm" style={{ marginTop: 8 }} onClick={() => deleteScope(scope.id)}>Delete scope</button>
          </div>
        );
      })}

      <button className="btn secondary block" onClick={addScope}>+ Add scope</button>

      {/* Margin sensitivity */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Margin sensitivity (whole quote)</h3>
        <div className="sensitivity">
          {sensitivity(t.costCents).map((r) => (
            <div className={`cell ${Math.abs(r.rate - 0.40) < 0.001 ? 'cur' : ''}`} key={r.rate}>
              <div className="muted small">{pct(r.rate)}</div>
              <div><b>{fmt(r.sellCents)}</b></div>
              <div className="small">profit {fmt(r.profitCents)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Track actuals */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Track actuals</h3>
          <button className="btn secondary sm" onClick={() => setActualsOpen((o) => !o)}>{actualsOpen ? 'Hide' : 'Show'}</button>
        </div>
        {actualsOpen && <ActualsPanel quoteId={quoteId} quotedSellCents={t.sellCents} actuals={actuals} onChange={async () => setActuals(await repo.listActuals(quoteId))} />}
      </div>

      {/* Sticky live blended margin */}
      <div className={`margin-bar ${underTarget ? 'out' : ''}`}>
        <div className="col"><span className="lab">Blended margin</span><span className="big">{pct(t.blendedMargin)}</span></div>
        <div className="col"><span className="lab">Sell (ex GST)</span><span><b>{fmt(t.sellCents)}</b></span></div>
        <div className="col"><span className="lab">GST</span><span>{fmt(t.gstCents)}</span></div>
        <div className="col"><span className="lab">Total incl</span><span><b>{fmt(t.grandTotalInclCents)}</b></span></div>
      </div>
    </>
  );
}

// Client & property capture. Cached on the quote now; CRM/properties modules become the source of truth later.
function DetailsPanel({ quote, onSave }: { quote: Quote; onSave: (patch: QuoteDetailsPatch) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: quote.clientName, address: quote.address,
    clientPhone: quote.clientPhone ?? '', clientEmail: quote.clientEmail ?? '', siteNotes: quote.siteNotes ?? '',
  });
  const [saved, setSaved] = useState(false);

  // Re-sync when switching to a different quote.
  useEffect(() => {
    setForm({
      clientName: quote.clientName, address: quote.address,
      clientPhone: quote.clientPhone ?? '', clientEmail: quote.clientEmail ?? '', siteNotes: quote.siteNotes ?? '',
    });
  }, [quote.id]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };
  const save = async () => {
    await onSave({
      clientName: form.clientName.trim() || quote.clientName,
      address: form.address.trim(),
      clientPhone: form.clientPhone.trim() || undefined,
      clientEmail: form.clientEmail.trim() || undefined,
      siteNotes: form.siteNotes.trim() || undefined,
    });
    setSaved(true);
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Client &amp; property</h3>
        <button className="btn secondary sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Edit'}</button>
      </div>
      {!open ? (
        <div className="muted small" style={{ marginTop: 6 }}>
          {quote.clientPhone && <>📞 {quote.clientPhone} &nbsp;</>}
          {quote.clientEmail && <>✉ {quote.clientEmail}</>}
          {!quote.clientPhone && !quote.clientEmail && <>No contact details yet — tap Edit to add phone/email.</>}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <label className="field"><span>Client name</span><input className="input" value={form.clientName} onChange={set('clientName')} /></label>
          <label className="field"><span>Property address</span><input className="input" value={form.address} onChange={set('address')} /></label>
          <label className="field"><span>Phone</span><input className="input" inputMode="tel" value={form.clientPhone} onChange={set('clientPhone')} placeholder="+64 21 123 4567" /></label>
          <label className="field"><span>Email</span><input className="input" inputMode="email" value={form.clientEmail} onChange={set('clientEmail')} placeholder="ger@example.co.nz" /></label>
          <label className="field"><span>Site / access notes <span className="muted">(internal — not shown to client)</span></span>
            <textarea className="input" rows={2} value={form.siteNotes} onChange={set('siteNotes')} placeholder="Gate code, dog, parking, where to dump…" /></label>
          <button className="btn block sm" style={{ marginTop: 4 }} onClick={save}>{saved ? 'Saved ✓' : 'Save details'}</button>
        </div>
      )}
    </div>
  );
}

function ActualsPanel({ quoteId, quotedSellCents, actuals, onChange }: {
  quoteId: string; quotedSellCents: number; actuals: ActualEntry[]; onChange: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const total = actuals.reduce((s, a) => s + a.amountCents, 0);
  const rec = reconcile(quotedSellCents, total, 0.40);

  const add = async () => {
    if (dollarsToCents(amount) <= 0) return;
    await repo.addActual({ quoteId, scopeId: null, lineItemId: null, description: desc || 'Actual cost', amountCents: dollarsToCents(amount) });
    setDesc(''); setAmount(''); onChange();
  };

  return (
    <div style={{ marginTop: 8 }}>
      {actuals.map((a) => (
        <div className="line" key={a.id}><div className="desc">{a.description}</div><div className="sell">{fmt(a.amountCents)}</div></div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input" style={{ flex: 2 }} placeholder="What" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="$ cost" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn sm" onClick={add}>Add</button>
      </div>
      {actuals.length > 0 && (
        <div className="preview" style={{ marginTop: 10 }}>
          <div>Actual cost: <b>{fmt(total)}</b> · Quoted sell: {fmt(quotedSellCents)}</div>
          <div>Actual margin: <b style={{ color: rec.onTarget ? '#15803d' : '#dc2626' }}>{pct(rec.actualMargin)}</b> (target {pct(rec.targetMargin)})</div>
          {!rec.onTarget && <div className="issue">⚠ Short of target. Sell {fmt(rec.sellToRecoverTargetCents)} to hit 40% ({fmt(rec.shortfallVsQuotedCents)} under quote).</div>}
        </div>
      )}
    </div>
  );
}
