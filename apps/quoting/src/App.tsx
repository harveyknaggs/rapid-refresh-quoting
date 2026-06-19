import { useState } from 'react';
import { QuoteList } from './QuoteList.tsx';
import { QuoteEditor } from './QuoteEditor.tsx';
import { ClientDoc } from './ClientDoc.tsx';
import { Settings } from './Settings.tsx';
import { RateBuilder } from './RateBuilder.tsx';

type View = { name: 'list' } | { name: 'edit'; id: string } | { name: 'doc'; id: string } | { name: 'settings' } | { name: 'rates' };

export function App() {
  const [view, setView] = useState<View>({ name: 'list' });

  return (
    <div className="app">
      <div className="topbar no-print">
        <h1 onClick={() => setView({ name: 'list' })} style={{ cursor: 'pointer' }}>🌿 Rapid Refresh — Quoting</h1>
        <div className="spacer" />
        {view.name !== 'list' && <button onClick={() => setView({ name: 'list' })}>Quotes</button>}
        <button onClick={() => setView({ name: 'rates' })} title="Rate builder">Rates</button>
        <button onClick={() => setView({ name: 'settings' })} title="Business details">⚙</button>
      </div>

      {view.name === 'list' && <QuoteList onOpen={(id) => setView({ name: 'edit', id })} />}
      {view.name === 'edit' && (
        <QuoteEditor
          quoteId={view.id}
          onBack={() => setView({ name: 'list' })}
          onViewDoc={(id) => setView({ name: 'doc', id })}
          onOpen={(id) => setView({ name: 'edit', id })}
        />
      )}
      {view.name === 'doc' && <ClientDoc quoteId={view.id} onBack={() => setView({ name: 'edit', id: view.id })} />}
      {view.name === 'settings' && <Settings onBack={() => setView({ name: 'list' })} />}
      {view.name === 'rates' && <RateBuilder onBack={() => setView({ name: 'list' })} />}
    </div>
  );
}
