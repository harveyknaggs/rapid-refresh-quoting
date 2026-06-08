import { useEffect, useState } from 'react';
import {
  deriveTitle, priceScope, priceQuoteVersion,
  type Quote, type QuoteVersion,
} from '@rapid-refresh/domain';
import { repo } from './repo.ts';
import { getBusiness } from './settings.ts';
import { fmt } from './format.ts';

// Client-facing document. Shows ONLY what the client should see — no internal cost rates or margins.
export function ClientDoc({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [version, setVersion] = useState<QuoteVersion | null>(null);

  useEffect(() => {
    (async () => {
      setQuote(await repo.getQuote(quoteId));
      // Prefer the accepted version if there is one, else current.
      const q = await repo.getQuote(quoteId);
      const v = q?.acceptedVersionId ? await repo.getVersion(q.acceptedVersionId) : await repo.getCurrentVersion(quoteId);
      setVersion(v);
    })();
  }, [quoteId]);

  if (!quote || !version) return <div className="card">Loading…</div>;
  const BUSINESS = getBusiness();
  const t = priceQuoteVersion(version).total;

  return (
    <>
      <div className="row no-print" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <button className="btn secondary sm" onClick={onBack}>← Back</button>
        <button className="btn sm" onClick={() => window.print()}>🖨 Print / Save PDF</button>
      </div>

      <div className="card doc">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--green-d)' }}>{BUSINESS.name}</h2>
            <div className="muted small">{BUSINESS.email} · {BUSINESS.phone}</div>
            <div className="muted small">GST {BUSINESS.gstNumber}</div>
          </div>
          <div className="right">
            <div><b>QUOTE</b></div>
            <div className="small">#{quote.quoteNumber} · v{version.version}</div>
            <div className="small muted">{new Date(version.createdAt || Date.now()).toLocaleDateString('en-NZ')}</div>
            <div className="small muted">Valid to {new Date(version.validUntil).toLocaleDateString('en-NZ')}</div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '14px 0' }} />

        <div className="small"><b>For:</b> {quote.clientName}</div>
        <div className="small"><b>Property:</b> {quote.address}</div>
        <h3 style={{ marginTop: 8 }}>{deriveTitle(quote.clientName, quote.address)}</h3>

        {version.scopes.map((s) => {
          const sp = priceScope(s);
          return (
            <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{s.title}</b><b>{fmt(sp.sellCents)}</b>
              </div>
              {s.description && <div className="muted small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.description}</div>}
            </div>
          );
        })}

        <div className="subtotal" style={{ marginTop: 12 }}><span>Subtotal (ex GST)</span><b>{fmt(t.sellCents)}</b></div>
        <div className="subtotal"><span>GST 15%</span><span>{fmt(t.gstCents)}</span></div>
        <div className="subtotal" style={{ fontSize: '1.15rem' }}><span><b>Total (incl GST)</b></span><b>{fmt(t.grandTotalInclCents)}</b></div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '14px 0' }} />
        <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{version.terms || BUSINESS.terms}</div>
        <div className="small muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{version.depositTerms || BUSINESS.deposit}</div>
      </div>
    </>
  );
}
