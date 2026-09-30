import React from 'react';
import PokemonAvatar from './PokemonAvatar';

export const NAV_VIEWS = ['home', 'calc', 'dex', 'meta', 'decks', 'collection', 'trading'];

const label = (view) => view.charAt(0).toUpperCase() + view.slice(1);

// Top pill navigation on larger screens, slide-out drawer on phones.
const SiteNav = ({ view, onNavigate, isOpen, user, profile, onSignOut, onSignIn }) => (
  <nav id="site-nav" aria-label="Main" className={`nav-ultra ${isOpen ? 'is-open' : ''}`}>
    {NAV_VIEWS.map(v => (
      <button
        key={v}
        className={`nav-pill ${view === v ? 'active' : ''}`}
        aria-current={view === v ? 'page' : undefined}
        onClick={() => onNavigate(v)}
      >
        {label(v)}
      </button>
    ))}

    <div className="auth-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className={`nav-avatar-btn ${view === 'profile' ? 'active' : ''}`}
            onClick={() => onNavigate('profile')}
            title={`${user} — your profile`}
            aria-label="Open your profile"
            aria-current={view === 'profile' ? 'page' : undefined}
          >
            <PokemonAvatar avatar={profile?.avatar} name={user} size={50} />
          </button>
          <button className="nav-pill" onClick={onSignOut} style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30' }}>
            Sign Out
          </button>
        </div>
      ) : (
        <button className="nav-pill" onClick={onSignIn} style={{ background: 'linear-gradient(135deg, #FF3B30 0%, #FF2D55 100%)', color: '#fff', fontWeight: 700 }}>
          Sign In
        </button>
      )}
    </div>
  </nav>
);

export default SiteNav;
