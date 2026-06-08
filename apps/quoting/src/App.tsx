import { useState } from 'react';
import { QuoteList } from './QuoteList.tsx';
import { QuoteEditor } from './QuoteEditor.tsx';
import { ClientDoc } from './ClientDoc.tsx';

type View = { name: 'list' } | { name: 'edit'; id: string } | { name: 'doc'; id: string };

export function App() {
  const [view, setView] = useState<View>({ name: 'list' });

  return (
    <div className="app">
      <div className="topbar no-print">
        <h1 onClick={() => setView({ name: 'list' })} style={{ cursor: 'pointer' }}>🌿 Rapid Refresh — Quoting</h1>
        <div className="spacer" />
        {view.name !== 'list' && <button onClick={() => setView({ name: 'list' })}>Quotes</button>}
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
    </div>
  );
}
