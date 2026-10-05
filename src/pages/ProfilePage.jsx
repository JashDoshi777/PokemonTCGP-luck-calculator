import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import PokemonAvatar from '../components/PokemonAvatar';
import AvatarPicker from '../components/AvatarPicker';
import AdminDashboard from '../components/AdminDashboard';
import { AVATAR_BACKGROUNDS, isValidAvatar } from '../data/avatars';
import './ProfilePage.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Used only if the account's avatar hasn't loaded yet, so the picker can always open.
const FALLBACK_AVATAR = { pokemon: 25, bg: AVATAR_BACKGROUNDS[5] };

const RARITY_TILES = [
  { key: 'crown', label: 'Crown Rare', icon: '/icons/crown.webp', codes: ['UR'] },
  { key: 'immersive', label: '3-Star Immersive', icon: '/icons/3star.webp', codes: ['IM'] },
  { key: 'special', label: '2-Star Special Art', icon: '/icons/2star.webp', codes: ['SAR', 'SR'] },
  { key: 'illustration', label: '1-Star Illustration', icon: '/icons/1star.webp', codes: ['AR'] },
  { key: 'shiny', label: 'Shiny', icon: '/icons/s2.webp', codes: ['S', 'SSR'] },
];

function formatMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const ProfilePage = ({ onRequestLogin, isActive = true }) => {
  const { user, profile, refreshProfile, saveProfile, cards, collection, wishlist, customDecks } = useAppContext();

  const [form, setForm] = useState({ email: '', inGameId: '' });
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }
  const [showPicker, setShowPicker] = useState(false);
  // Admins get a Profile | Dashboard switch; the choice is remembered for the session.
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem('tcgp_profile_tab') === 'dashboard' ? 'dashboard' : 'profile'; } catch { return 'profile'; }
  });
  const switchTab = (next) => {
    setTab(next);
    try { sessionStorage.setItem('tcgp_profile_tab', next); } catch { /* ignore */ }
  };

  // Pull fresh account data whenever this tab is opened (e.g. after a Calculator run).
  useEffect(() => {
    if (isActive && user) refreshProfile();
  }, [isActive, user]);

  // Fill the form from the account, unless the user is mid-edit.
  useEffect(() => {
    if (profile && !dirty) {
      setForm({ email: profile.email || '', inGameId: profile.inGameId || '' });
    }
  }, [profile?.email, profile?.inGameId, dirty]);

  const stats = useMemo(() => {
    const mainCards = (cards || []).filter(c => !String(c.set).startsWith('PROMO'));
    const isOwned = (c) => (collection[`${c.set}-${c.number}`] || 0) > 0;

    const perSet = new Map();
    const rarityCounts = {};
    let ownedUnique = 0;

    for (const c of mainCards) {
      const entry = perSet.get(c.set) || { total: 0, owned: 0 };
      entry.total += 1;
      if (isOwned(c)) {
        entry.owned += 1;
        ownedUnique += 1;
        rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1;
      }
      perSet.set(c.set, entry);
    }

    const setsCompleted = [...perSet.values()].filter(s => s.total > 0 && s.owned === s.total).length;
    const copies = Object.values(collection).reduce((sum, n) => sum + (n || 0), 0);

    return {
      totalCards: mainCards.length,
      ownedUnique,
      copies,
      completion: mainCards.length ? Math.round((ownedUnique / mainCards.length) * 1000) / 10 : 0,
      setsCompleted,
      totalSets: perSet.size,
      rarityCounts,
    };
  }, [cards, collection]);

  if (!user) {
    return (
      <div className="profile-page animate-enter profile-signed-out">
        <h2>Your Trainer Profile</h2>
        <p>Sign in to get your Pokémon avatar, track your stats and manage your account.</p>
        <button className="btn-super" onClick={onRequestLogin}>Sign In</button>
      </div>
    );
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setNotice(null);
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const inGameId = form.inGameId.trim();

    if (email && !EMAIL_PATTERN.test(email)) {
      setNotice({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    const patch = {};
    if (email !== (profile?.email || '')) patch.email = email;
    if (inGameId !== (profile?.inGameId || '')) patch.inGameId = inGameId;
    if (Object.keys(patch).length === 0) {
      setDirty(false);
      return;
    }

    setDirty(false);
    setNotice({ type: 'success', text: 'Saved' });
    const result = await saveProfile(patch);
    if (!result.ok) {
      setDirty(true);
      setNotice({ type: 'error', text: result.error || 'Could not save your changes.' });
    }
  };

  const handleSaveAvatar = async (avatar) => {
    setShowPicker(false);
    const result = await saveProfile({ avatar });
    if (!result.ok) setNotice({ type: 'error', text: result.error || 'Could not save your avatar.' });
  };

  const luck = profile?.luckLast;
  const memberSince = formatMonth(profile?.createdAt);
  const tradeCounts = profile?.tradeCounts || { offering: 0, requesting: 0 };

  const showDashboard = !!profile?.isAdmin && tab === 'dashboard';

  return (
    <div className="profile-page animate-enter">
      {profile?.isAdmin && (
        <div className="apple-segmented-control adm-switch" role="tablist" aria-label="Profile or admin dashboard">
          <button role="tab" aria-selected={tab === 'profile'} className={`segmented-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => switchTab('profile')}>Profile</button>
          <button role="tab" aria-selected={tab === 'dashboard'} className={`segmented-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => switchTab('dashboard')}>Dashboard</button>
        </div>
      )}

      {showDashboard ? <AdminDashboard /> : (
      <>
      <div className="glass-panel profile-hero">
        <button className="profile-avatar-btn" onClick={() => setShowPicker(true)} aria-label="Change avatar">
          <PokemonAvatar avatar={profile?.avatar} name={user} size={128} />
          <span className="profile-avatar-edit"><Pencil size={14} /></span>
        </button>
        <div className="profile-hero-text">
          <h2 className="text-gradient profile-name">{user}</h2>
          <div className="profile-meta">
            {memberSince && <span>Trainer since {memberSince}</span>}
            <span className="profile-endorsements"><Star size={14} fill="currentColor" /> {profile?.successfulTrades || 0} endorsements</span>
          </div>
          <button className="profile-change-avatar" onClick={() => setShowPicker(true)}>Change avatar</button>
        </div>
      </div>

      <div className="glass-card profile-section">
        <h3>Account</h3>
        <form onSubmit={handleSaveDetails} className="profile-form">
          <label>
            <span>Username</span>
            <input className="apple-input" type="text" value={user} disabled readOnly />
          </label>
          <label>
            <span>Email</span>
            <input
              className="apple-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
            />
          </label>
          <label>
            <span>In-game ID</span>
            <input
              className="apple-input"
              type="text"
              placeholder="e.g. 1234-5678-9012"
              maxLength={64}
              value={form.inGameId}
              onChange={e => updateField('inGameId', e.target.value)}
            />
          </label>
          <div className="profile-form-footer">
            {notice && <span className={`profile-notice ${notice.type}`}>{notice.text}</span>}
            <button type="submit" className="apple-btn-primary profile-save" disabled={!dirty}>Save changes</button>
          </div>
        </form>
      </div>

      <div className="profile-stats-grid">
        <div className="glass-card profile-stat profile-stat-luck">
          <div className="profile-stat-label">Luck</div>
          {luck ? (
            <>
              <div className="profile-stat-value">{luck.score.toFixed(1)}<small>/10</small></div>
              <div className="profile-stat-sub">
                Luckier than {Math.round(luck.percentile)}% of trainers opening {luck.packs.toLocaleString()} packs
              </div>
            </>
          ) : (
            <>
              <div className="profile-stat-value muted">—</div>
              <div className="profile-stat-sub">Run the Calculator to see your luck score here.</div>
            </>
          )}
        </div>

        <div className="glass-card profile-stat">
          <div className="profile-stat-label">Collection</div>
          <div className="profile-stat-value">{stats.completion}<small>%</small></div>
          <div className="profile-progress"><div style={{ width: `${Math.min(100, stats.completion)}%` }} /></div>
          <div className="profile-stat-sub">{stats.ownedUnique.toLocaleString()} of {stats.totalCards.toLocaleString()} cards</div>
        </div>

        <div className="glass-card profile-stat">
          <div className="profile-stat-label">Sets completed</div>
          <div className="profile-stat-value">{stats.setsCompleted}<small>/{stats.totalSets}</small></div>
          <div className="profile-stat-sub">{stats.copies.toLocaleString()} total cards incl. duplicates</div>
        </div>

        <div className="glass-card profile-stat profile-stat-wide">
          <div className="profile-stat-label">Trading</div>
          <div className="profile-stat-value">{profile?.successfulTrades || 0}<small> endorsements</small></div>
          <div className="profile-stat-sub">Offering {tradeCounts.offering} · Requesting {tradeCounts.requesting}</div>
        </div>

        <div className="glass-card profile-stat profile-stat-wide">
          <div className="profile-stat-label">Wishlist &amp; decks</div>
          <div className="profile-stat-value">{Object.values(wishlist).filter(Boolean).length}<small> wishlisted</small></div>
          <div className="profile-stat-sub">{(customDecks || []).length} saved deck{(customDecks || []).length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="glass-card profile-section">
        <h3>Rare pulls you own</h3>
        <div className="profile-rarity-grid">
          {RARITY_TILES.map(tile => {
            const count = tile.codes.reduce((sum, code) => sum + (stats.rarityCounts[code] || 0), 0);
            return (
              <div key={tile.key} className="profile-rarity-tile">
                <img src={tile.icon} alt="" />
                <div className="profile-rarity-count">{count}</div>
                <div className="profile-rarity-label">{tile.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portalled to <body>: this page fades in with a transform, which would
          otherwise make the fixed-position popup align to the page column
          instead of the screen. */}
      {showPicker && createPortal(
        <AvatarPicker
          current={isValidAvatar(profile?.avatar) ? profile.avatar : FALLBACK_AVATAR}
          name={user}
          onSave={handleSaveAvatar}
          onClose={() => setShowPicker(false)}
        />,
        document.body
      )}
      </>
      )}
    </div>
  );
};

export default ProfilePage;
