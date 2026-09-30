import React, { Suspense, lazy, useState, useRef, useEffect, useCallback } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ReactLenis, useLenis } from 'lenis/react';

import { PACKS } from './data';
import { getAllPacks } from './services/PacksService';
import { trackSession, trackView } from './services/analytics';
import { local, session } from './utils/storage';
import './styles/controls.css';

import { AppProvider, useAppContext } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import SiteNav from './components/SiteNav';
import LoginModal from './components/LoginModal';
import ProModal from './components/ProModal';
import LandingPage from './pages/LandingPage';
import Calculator from './pages/Calculator';
import DexPage from './pages/DexPage';

// Everything except the landing page, calculator and Dex is loaded the first
// time it is opened, which keeps the initial download small.
const MetaDecks = lazy(() => import('./pages/MetaDecks'));
const DeckBuilder = lazy(() => import('./pages/DeckBuilder'));
const CollectionTracker = lazy(() => import('./pages/CollectionTracker'));
const TradingCenter = lazy(() => import('./pages/TradingCenter'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

const VIEWS = ['home', 'calc', 'dex', 'meta', 'decks', 'collection', 'trading', 'profile'];
const TITLES = {
  home: 'Pokémon TCG Pocket Luck Calculator',
  calc: 'Luck Calculator',
  dex: 'Pack Archives',
  meta: 'Meta Decks',
  decks: 'Deck Builder',
  collection: 'Collection Tracker',
  trading: 'Trading Center',
  profile: 'Profile'
};
const TRANSITION_MS = 250;
const MAX_HISTORY = 50;

const isView = (v) => VIEWS.includes(v);

// Let any element that can scroll on its own (modals, inner lists) keep the
// native wheel instead of Lenis hijacking it for the page behind.
const canScrollInside = (node) => {
  for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.nodeType !== 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
  }
  return false;
};

const LENIS_OPTIONS = { lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.5, prevent: canScrollInside };

function PageLoader() {
  return <div className="page-loader" role="status" aria-live="polite">Loading…</div>;
}

// A page that has been opened once stays mounted (hidden) so switching back is instant.
function Page({ name, active, children }) {
  return (
    <div style={{ display: active ? 'block' : 'none' }}>
      <ErrorBoundary scope="page" name={name}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  );
}

function AppContent() {
  const { user, logout, profile, sessionExpired, dismissSessionNotice, error: catalogError, reloadCatalog } = useAppContext();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [theme, setTheme] = useState(() => local.get('pokemontcgp-theme') === 'dark' ? 'dark' : 'light');

  const [view, setView] = useState(() => {
    const stored = session.get('pokemontcgp-view');
    return isView(stored) ? stored : 'home';
  });
  const [history, setHistory] = useState(() => {
    const stored = session.getJSON('pokemontcgp-history', []);
    return Array.isArray(stored) ? stored.filter(isView).slice(-MAX_HISTORY) : [];
  });
  // Pages are mounted the first time they are visited. The current page and
  // everything in the back stack count as visited, so Back always has a page to show.
  const [visitedViews, setVisitedViews] = useState(() => {
    const stored = session.get('pokemontcgp-view');
    const initial = isView(stored) ? stored : 'home';
    const past = session.getJSON('pokemontcgp-history', []);
    return new Set([initial, ...(Array.isArray(past) ? past.filter(isView) : [])]);
  });
  const [dexSelectedPack, setDexSelectedPack] = useState(null);
  const [dexPacks, setDexPacks] = useState(PACKS);

  const viewRef = useRef(view);
  const transitionTimer = useRef(null);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => () => clearTimeout(transitionTimer.current), []);

  useEffect(() => {
    let cancelled = false;
    getAllPacks().then(packs => { if (!cancelled) setDexPacks(packs); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    session.set('pokemontcgp-view', view);
    session.setJSON('pokemontcgp-history', history);
  }, [view, history]);

  // Anonymous usage counting for the admin dashboard.
  useEffect(() => { trackSession(); }, []);
  useEffect(() => { trackView(view); }, [view]);

  useEffect(() => {
    document.title = view === 'home' ? TITLES.home : `${TITLES[view]} · TCG Pocket Luck`;
  }, [view]);

  useEffect(() => {
    local.set('pokemontcgp-theme', theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }, [theme]);

  // A login that lapsed mid-session asks the person to sign in again.
  useEffect(() => {
    if (sessionExpired) setShowLoginModal(true);
  }, [sessionExpired]);

  const anyModalOpen = !!dexSelectedPack || showLoginModal || showProModal;
  useEffect(() => {
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [anyModalOpen]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', isMobileMenuOpen);
    if (!isMobileMenuOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('menu-open');
    };
  }, [isMobileMenuOpen]);

  // Fade out, swap the page, fade in. Clicks that arrive mid-transition are
  // ignored, so rapid taps can't push duplicate entries onto the back stack.
  const navigate = useCallback((nextView, direction) => {
    if (transitionTimer.current || nextView === viewRef.current || !isView(nextView)) return;

    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      setVisitedViews(prev => (prev.has(nextView) ? prev : new Set(prev).add(nextView)));
      setHistory(prev => (direction === 'back' ? prev.slice(0, -1) : [...prev, viewRef.current].slice(-MAX_HISTORY)));
      setView(nextView);
      setDexSelectedPack(null);
      window.scrollTo(0, 0);

      // Let React render the new view, then fade back in
      requestAnimationFrame(() => {
        setTimeout(() => setIsTransitioning(false), 50);
      });
    }, TRANSITION_MS);
  }, []);

  const handleSetView = useCallback((nextView) => {
    setIsMobileMenuOpen(false);
    navigate(nextView, 'push');
  }, [navigate]);

  const handleBack = () => {
    if (view === 'dex' && dexSelectedPack) {
      setDexSelectedPack(null);
      window.scrollTo(0, 0);
      return;
    }
    if (history.length > 0) navigate(history[history.length - 1], 'back');
  };

  const openLogin = () => { setShowLoginModal(true); setIsMobileMenuOpen(false); };
  const closeLogin = () => { setShowLoginModal(false); dismissSessionNotice(); };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div className={`ambient-background ${view === 'home' ? '' : 'is-still'}`} aria-hidden="true">
        <div className="ambient-blob blob-1"></div>
        <div className="ambient-blob blob-2"></div>
        <div className="ambient-blob blob-3"></div>
      </div>

      <button className="pro-nav-btn" onClick={() => setShowProModal(true)} aria-label="About Pro">
        Pro
      </button>

      <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
      </button>

      {(history.length > 0 || dexSelectedPack) && (
        <button onClick={handleBack} className="ios-back-btn" aria-label="Go back">
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }} aria-hidden="true">
            <path d="M10 1L2 10L10 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      )}

      {/* MOBILE SIDEBAR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* MOBILE TOGGLE BUTTON */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsMobileMenuOpen(open => !open)}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="site-nav"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {isMobileMenuOpen ? (
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          ) : (
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          )}
        </svg>
      </button>

      <SiteNav
        view={view}
        onNavigate={handleSetView}
        isOpen={isMobileMenuOpen}
        user={user}
        profile={profile}
        onSignOut={() => { logout(); setIsMobileMenuOpen(false); }}
        onSignIn={openLogin}
      />

      <main
        id="main-content"
        className={`app-view-container ${isTransitioning ? 'fade-out' : 'fade-in'}`}
        style={{ paddingTop: '100px', paddingBottom: '100px', maxWidth: '1400px', margin: '0 auto', paddingLeft: '5%', paddingRight: '5%' }}
      >
        {catalogError && view !== 'home' && (
          <div className="app-banner" role="alert">
            <span>We couldn't load the card database, so some pages may look empty.</span>
            <button type="button" onClick={reloadCatalog}>Try again</button>
          </div>
        )}

        {view === 'home' && <LandingPage setView={handleSetView} />}

        {/* Calculator (always the global pool) */}
        {view === 'calc' && <Calculator mode="overall" selectedPack={PACKS[0]} />}

        {view === 'dex' && (
          <DexPage
            packs={dexPacks}
            selectedPack={dexSelectedPack}
            onSelectPack={setDexSelectedPack}
            onClosePack={() => setDexSelectedPack(null)}
          />
        )}

        {visitedViews.has('meta') && <Page name="Meta Decks" active={view === 'meta'}><MetaDecks /></Page>}
        {visitedViews.has('decks') && <Page name="Deck Builder" active={view === 'decks'}><DeckBuilder onRequestLogin={openLogin} /></Page>}
        {visitedViews.has('collection') && <Page name="Collection" active={view === 'collection'}><CollectionTracker /></Page>}
        {visitedViews.has('trading') && (
          <Page name="Trading" active={view === 'trading'}>
            <TradingCenter onRequestLogin={openLogin} onOpenProfile={() => handleSetView('profile')} isActive={view === 'trading'} />
          </Page>
        )}
        {visitedViews.has('profile') && (
          <Page name="Profile" active={view === 'profile'}>
            <ProfilePage onRequestLogin={openLogin} isActive={view === 'profile'} />
          </Page>
        )}
      </main>

      {showLoginModal && (
        <LoginModal
          onClose={closeLogin}
          notice={sessionExpired ? 'Your session expired. Please sign in again to keep your collection in sync.' : undefined}
        />
      )}
      {showProModal && <ProModal onClose={() => setShowProModal(false)} onRequestLogin={openLogin} />}
    </>
  );
}

// Keeps GSAP ScrollTrigger (the landing page's scroll animations) in step with
// Lenis' smoothed scroll position instead of lagging a frame behind it.
function LenisScrollTriggerSync() {
  useLenis(() => ScrollTrigger.update());
  return null;
}

function App() {
  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      <LenisScrollTriggerSync />
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ReactLenis>
  );
}

export default App;
