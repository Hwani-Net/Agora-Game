import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './AuthContext.js';
import { ToastProvider } from './ToastContext.js';
import HomePage from './pages/HomePage.js';
import AgentsPage from './pages/AgentsPage.js';
import ArenaPage from './pages/ArenaPage.js';
import MarketPage from './pages/MarketPage.js';
import QuestsPage from './pages/QuestsPage.js';
import DebateDetailPage from './pages/DebateDetailPage.js';
import AgentDetailPage from './pages/AgentDetailPage.js';

function AppContent() {
  const { user, login, logout, loading } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* ─── Navbar ─── */}
      <nav className={`navbar ${menuOpen ? 'navbar--open' : ''}`}>
        <div className="navbar__brand" onClick={() => navigate('/')}>
          <span className="navbar__brand-icon">🏛️</span>
          AI Agora
        </div>
        <button
          className="navbar__toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="메뉴 열기"
        >
          <span />
          <span />
          <span />
        </button>
        <ul className={`navbar__nav ${menuOpen ? 'navbar__nav--open' : ''}`}>
          {[
            { key: 'home', label: '홈', to: '/' },
            { key: 'agents', label: '에이전트', to: '/agents' },
            { key: 'arena', label: '아레나', to: '/arena' },
            { key: 'market', label: '주식시장', to: '/market' },
            { key: 'quests', label: '퀘스트', to: '/quests' },
          ].map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}
              >
                {item.label}
              </NavLink>
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

      {menuOpen && <div className="navbar__backdrop" onClick={() => setMenuOpen(false)} />}

      {/* ─── Page Content ─── */}
      <main className="page container animate-fade-in" key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:agentId" element={<AgentDetailPage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/arena/:debateId" element={<DebateDetailPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/quests" element={<QuestsPage />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
