import { useState, type ReactNode } from 'react';

// Client-side access code. Deters casual access on a public URL.
// (Not encryption — the app code is still downloadable. Change the code here anytime.)
const ACCESS_CODE = 'rapid2026';
const KEY = 'rr.unlocked';

export function Gate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(() => localStorage.getItem(KEY) === '1');
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);

  if (ok) return <>{children}</>;

  const submit = () => {
    if (code.trim() === ACCESS_CODE) { localStorage.setItem(KEY, '1'); setOk(true); }
    else { setErr(true); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 340, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🌿</div>
        <h2 style={{ marginTop: 6 }}>Rapid Refresh — Quoting</h2>
        <p className="muted small">Enter your access code.</p>
        <input
          className="input" type="password" inputMode="text" value={code} autoFocus
          onChange={(e) => { setCode(e.target.value); setErr(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Access code"
        />
        {err && <div className="issue" style={{ textAlign: 'left' }}>⚠ Incorrect code.</div>}
        <button className="btn block" style={{ marginTop: 12 }} onClick={submit}>Unlock</button>
      </div>
    </div>
  );
}
