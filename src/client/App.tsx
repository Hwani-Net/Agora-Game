import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuthContext } from './AuthContext.js';
import { ToastProvider, useToast } from './ToastContext.js';
import { ThemeProvider, useTheme } from './ThemeContext.js';
import { supabase } from './supabase.js';
import HomePage from './pages/HomePage.js';
import AgentsPage from './pages/AgentsPage.js';
import ArenaPage from './pages/ArenaPage.js';
import MarketPage from './pages/MarketPage.js';
import QuestsPage from './pages/QuestsPage.js';
import DebateDetailPage from './pages/DebateDetailPage.js';
import AgentDetailPage from './pages/AgentDetailPage.js';
import CreateAgentPage from './pages/CreateAgentPage.js';
import LiveDebatePage from './pages/LiveDebatePage.js';
import ProfilePage from './pages/ProfilePage.js';
import NewsPage from './pages/NewsPage.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';
import LeaderboardPage from './pages/LeaderboardPage.js';

// ─── Theme Toggle ───

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const icons: Record<string, string> = { dark: '🌙', light: '☀️', system: '🖥️' };
  const next: Record<string, 'dark' | 'light' | 'system'> = { dark: 'light', light: 'system', system: 'dark' };

  return (
    <button
      className="btn btn--ghost btn--sm theme-toggle-btn"
      onClick={() => setTheme(next[theme])}
      title={theme}
    >
      {icons[theme]}
    </button>
  );
}

// ─── Language Toggle ───

function LangToggle() {
  const { i18n } = useTranslation();
  const next = i18n.language.startsWith('ko') ? 'en' : 'ko';

  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={() => i18n.changeLanguage(next)}
      style={{ fontWeight: 700, fontSize: '0.75rem', padding: '6px 10px' }}
    >
      {i18n.language.startsWith('ko') ? 'KO' : 'EN'}
    </button>
  );
}

// ─── Login Dropdown ───

function LoginActions() {
  const { t } = useTranslation();
  const { user, login, loginWithGoogle, logout, loading } = useAuthContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />;
  }

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => navigate('/profile')}
          style={{ textDecoration: 'none' }}
        >
          👤 {user.name}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={logout} title={t('nav.logout')}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="login-dropdown" style={{ position: 'relative' }}>
      <button
        className="btn btn--primary btn--sm"
        onClick={() => setOpen((p) => !p)}
      >
        {t('nav.login')}
      </button>
      {open && (
        <div className="login-dropdown__menu">
          <button
            className="login-dropdown__item"
            onClick={() => { loginWithGoogle(); setOpen(false); }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('nav.google_login')}
          </button>
          <button
            className="login-dropdown__item"
            onClick={() => { login('Demo User'); setOpen(false); }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>👤</span>
            {t('nav.demo_login')}
          </button>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const { pushToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('agora_onboarding_done')
  );
  const [hasNewQuests, setHasNewQuests] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Clear quest badge when visiting quests page
  useEffect(() => {
    if (location.pathname === '/quests') {
      setHasNewQuests(false);
    }
    setMenuOpen(false);
  }, [location.pathname]);

  // Realtime: notify when new quests are generated
  const handleNewQuest = useCallback(() => {
    if (location.pathname !== '/quests') {
      setHasNewQuests(true);
      pushToast(t('nav.new_quest_available'), 'success');
    }
  }, [location.pathname, pushToast, t]);

  useEffect(() => {
    const channel = supabase
      .channel('global-quest-watcher')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quests' }, handleNewQuest)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [handleNewQuest]);

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
          aria-label={menuOpen ? t('nav.menu_close') : t('nav.menu_open')}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
        >
          <span />
          <span />
          <span />
        </button>
        <div
          id="primary-nav"
          className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}
        >
          <ul className="navbar__nav">
            {[
              { key: 'home', label: t('nav.home'), to: '/' },
              { key: 'agents', label: t('nav.agents'), to: '/agents' },
              { key: 'arena', label: t('nav.arena'), to: '/arena' },
              { key: 'market', label: t('nav.market'), to: '/market' },
              { key: 'quests', label: (
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('nav.quests')}
                  {hasNewQuests && (
                    <span className="nav-badge" aria-label="New quests available" />
                  )}
                </span>
              ), to: '/quests' },
              { key: 'news', label: `📰 ${t('nav.news')}`, to: '/news' },
              { key: 'leaderboard', label: `🏆 ${t('nav.leaderboard')}`, to: '/leaderboard' },
              ...(user ? [{ key: 'profile', label: `👤 ${t('nav.profile')}`, to: '/profile' }] : []),
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
            <LangToggle />
            <ThemeToggle />
            {user && (
              <div className="navbar__gold">
                <span>💰</span>
                <span>{user.gold_balance.toLocaleString()} {t('nav.gold')}</span>
              </div>
            )}
            <LoginActions />
          </div>
        </div>
      </nav>

      {menuOpen && <div className="navbar__backdrop" onClick={() => setMenuOpen(false)} />}

      {/* ─── Page Content ─── */}
      <main className="page container animate-fade-in" key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/create" element={<CreateAgentPage />} />
          <Route path="/agents/:agentId" element={<AgentDetailPage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/arena/live" element={<LiveDebatePage />} />
          <Route path="/arena/:debateId" element={<DebateDetailPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/quests" element={<QuestsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>

      {showOnboarding && (
        <OnboardingOverlay onClose={() => setShowOnboarding(false)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
