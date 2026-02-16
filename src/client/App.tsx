import { useState } from 'react';
import { AuthProvider, useAuthContext } from './AuthContext.js';
import HomePage from './pages/HomePage.js';
import AgentsPage from './pages/AgentsPage.js';
import ArenaPage from './pages/ArenaPage.js';
import MarketPage from './pages/MarketPage.js';
import QuestsPage from './pages/QuestsPage.js';

type Page = 'home' | 'agents' | 'arena' | 'market' | 'quests';

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const { user, login, logout, loading } = useAuthContext();

  const nav = (p: Page) => setPage(p);

  return (
    <>
      {/* ─── Navbar ─── */}
      <nav className="navbar">
        <div className="navbar__brand" onClick={() => nav('home')}>
          <span className="navbar__brand-icon">🏛️</span>
          AI Agora
        </div>
        <ul className="navbar__nav">
          {[
            { key: 'home' as Page, label: '홈' },
            { key: 'agents' as Page, label: '에이전트' },
            { key: 'arena' as Page, label: '아레나' },
            { key: 'market' as Page, label: '주식시장' },
            { key: 'quests' as Page, label: '퀘스트' },
          ].map((item) => (
            <li key={item.key}>
              <span
                className={`navbar__link ${page === item.key ? 'navbar__link--active' : ''}`}
                onClick={() => nav(item.key)}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <div className="navbar__actions">
          {user && (
            <div className="navbar__gold">
              <span>💰</span>
              <span>{user.gold_balance.toLocaleString()} G</span>
            </div>
          )}
          {loading ? (
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          ) : user ? (
            <button className="btn btn--ghost btn--sm" onClick={logout}>
              {user.name} ✕
            </button>
          ) : (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => login('Demo User')}
            >
              데모 로그인
            </button>
          )}
        </div>
      </nav>

      {/* ─── Page Content ─── */}
      <main className="page container animate-fade-in" key={page}>
        {page === 'home' && <HomePage onNavigate={nav} />}
        {page === 'agents' && <AgentsPage />}
        {page === 'arena' && <ArenaPage />}
        {page === 'market' && <MarketPage />}
        {page === 'quests' && <QuestsPage />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
