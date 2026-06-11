import { useEffect, useState } from 'react';
import {
  ulid, deriveTitle, priceQuoteVersion,
  type Quote, type QuoteStatus,
} from '@rapid-refresh/domain';
import { repo } from './repo.ts';
import { fmt } from './format.ts';

const STATUSES: (QuoteStatus | 'all')[] = ['all', 'draft', 'sent', 'accepted', 'declined', 'invoiced'];

interface Row { quote: Quote; status: QuoteStatus; sellCents: number; }

export function QuoteList({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const load = async () => {
    const quotes = await repo.listQuotes({ text: text || undefined, status: status === 'all' ? undefined : status });
    const enriched: Row[] = [];
    for (const q of quotes) {
      const v = await repo.getCurrentVersion(q.id);
      enriched.push({ quote: q, status: v?.status ?? 'draft', sellCents: v ? priceQuoteVersion(v).total.sellCents : 0 });
    }
    setRows(enriched);
  };
  useEffect(() => { load(); }, [text, status]);

  const [err, setErr] = useState('');

  const create = async () => {
    if (!name.trim() || !address.trim()) { setErr('Enter a client name and a property address.'); return; }
    setErr('');
    try {
      // clientId/propertyId are placeholders until linked to the CRM/properties modules.
      const { quote } = await repo.createQuote({
        clientId: ulid(), propertyId: ulid(),
        clientName: name.trim(), address: address.trim(),
        clientPhone: phone.trim() || undefined, clientEmail: email.trim() || undefined,
      });
      onOpen(quote.id);
    } catch (e: any) {
      setErr(`Couldn't create the quote: ${e?.message ?? e}`);
    }
  };

  const remove = async (q: Quote) => {
    if (!confirm(`Delete quote #${q.quoteNumber} for ${q.clientName}? This removes all its versions and can't be undone.`)) return;
    await repo.deleteQuote(q.id);
    load();
  };

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Quotes</h2>
          <button className="btn sm" onClick={() => setShowNew((s) => !s)}>{showNew ? 'Close' : '+ New quote'}</button>
        </div>

        {showNew && (
          <div className="preview" style={{ marginTop: 10 }}>
            <label className="field"><span>Client name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ger Murphy" /></label>
            <label className="field"><span>Property address</span><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 5 Beach Rd, Mount Maunganui" /></label>
            <label className="field"><span>Phone <span className="muted">(optional)</span></span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +64 21 123 4567" /></label>
            <label className="field"><span>Email <span className="muted">(optional)</span></span><input className="input" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. ger@example.co.nz" /></label>
            <button className="btn block" onClick={create}>Create quote</button>
            {err && <div className="issue" style={{ marginTop: 8 }}>⚠ {err}</div>}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Search client or address…" value={text} onChange={(e) => setText(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | 'all')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 && <div className="muted">No quotes yet. Tap “+ New quote”.</div>}
        {rows.map(({ quote, status, sellCents }) => (
          <div className="q-item" key={quote.id} onClick={() => onOpen(quote.id)} style={{ cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <div className="title">{deriveTitle(quote.clientName, quote.address)}</div>
              <div className="muted small">#{quote.quoteNumber} · {fmt(sellCents)} ex GST</div>
            </div>
            <span className={`badge ${status}`}>{status}</span>
            <button className="x" title="Delete quote" onClick={(e) => { e.stopPropagation(); remove(quote); }}>✕</button>
          </div>
        ))}
      </div>
    </>
  );
}
