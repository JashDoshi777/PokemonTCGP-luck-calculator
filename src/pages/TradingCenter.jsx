import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useDialog } from '../hooks/useDialog';
import PokemonCard from '../components/PokemonCard';
import { Search, X, Check, MessageCircle, Heart, ArrowRightLeft, Bell, Star } from 'lucide-react';
import '../components/AppleSearchBar.css'; // styles for the card search field in the search sheet
import './CollectionTracker.css'; // Reuse existing styles where possible
import './TradingCenter.css';

const LISTING_SAVE_DELAY_MS = 500;
const CHAT_POLL_MS = 5000;
const NOTIFICATION_POLL_MS = 10000;

// Card ids are "${set}-${number}" - split on the LAST hyphen, not the first,
// since some set codes (e.g. promo sets) contain hyphens themselves.
function parseCardId(id) {
  const lastDash = id.lastIndexOf('-');
  return { set: id.slice(0, lastDash), num: id.slice(lastDash + 1) };
}

const isOnline = (secondsSinceActive) => (
  secondsSinceActive !== null && secondsSinceActive !== undefined && secondsSinceActive < 5 * 60
);

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

// Modal shells (kept here so each gets dialog behaviour: Escape, focus trap, focus restore).
function SearchSheet({ mode, searchQuery, onQueryChange, results, selectedIds, onToggle, onClose }) {
  const dialogRef = useDialog(onClose);
  return (
    <div className="ios-backdrop" onClick={onClose} data-lenis-prevent="true">
      <div
        className="ios-bottom-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Search cards to ${mode === 'offering' ? 'offer' : 'request'}`}
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div className="drag-indicator"></div>
          <button className="ios-close-btn" onClick={onClose} aria-label="Close search">
            <X size={12} />
          </button>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Search Cards to {mode === 'offering' ? 'Offer' : 'Request'}</h2>
        </div>
        <div className="sheet-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }} data-lenis-prevent="true">
          <div style={{ padding: '0px 20px 10px' }}>
            <div className="apple-search-input-wrapper active">
              <Search size={20} className="apple-search-icon" />
              <input
                data-autofocus
                type="text"
                className="apple-search-input"
                placeholder="Search by Pokémon name..."
                aria-label="Search by Pokémon name"
                value={searchQuery}
                onChange={(e) => onQueryChange(e.target.value)}
                style={{ color: 'var(--text-main)' }}
              />
            </div>
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 4px 0' }}>Type at least 3 letters to search.</div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 40px', minHeight: 0 }} data-lenis-prevent="true">
            <div className="collection-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
              {results.map(card => {
                const id = `${card.set}-${card.number}`;
                const isSelected = selectedIds.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    className="trade-search-result"
                    style={{ position: 'relative', cursor: 'pointer', opacity: isSelected ? 0.5 : 1, transition: '0.2s', background: 'none', border: 'none', padding: 0 }}
                    onClick={() => onToggle(mode, id)}
                    aria-pressed={isSelected}
                    aria-label={`${card.name} ${isSelected ? '(selected)' : ''}`}
                  >
                    <PokemonCard card={card} />
                    {isSelected && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#34c759', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        <Check size={20} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatSheet({ chatUser, currentUser, messages, chatInput, onInputChange, onSend, sending, chatNotice, onClose, onEndorse, onComplete, containerRef }) {
  const dialogRef = useDialog(onClose);
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  return (
    <div className="ios-backdrop" onClick={onClose} data-lenis-prevent="true">
      <div
        className="ios-bottom-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${chatUser.username}`}
        style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div className="drag-indicator"></div>
          <button className="ios-close-btn" onClick={onClose} aria-label="Close chat">
            <X size={12} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #0a84ff, #5ac8fa)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, position: 'relative' }}>
              {chatUser.username.charAt(0).toUpperCase()}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: isOnline(chatUser.lastActive) ? '#34c759' : '#8e8e93', border: '2px solid var(--bg-main)' }}></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{chatUser.username}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,214,10,0.15)', color: '#b38f00', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Star size={12} fill="currentColor" /> {chatUser.successfulTrades || 0}
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isOnline(chatUser.lastActive) ? 'Online now' : 'Offline'}</div>
            </div>
            <div className="trade-chat-actions" style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => onEndorse(chatUser.userId)} style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#1f9d45', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={14} fill="currentColor" /> Endorse
              </button>
              {confirmingComplete ? (
                <>
                  <button type="button" onClick={() => { setConfirmingComplete(false); onComplete(); }} style={{ background: '#0a84ff', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                    Remove traded cards
                  </button>
                  <button type="button" onClick={() => setConfirmingComplete(false)} style={{ background: 'rgba(128,128,140,0.16)', color: 'inherit', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmingComplete(true)} style={{ background: 'rgba(0, 122, 255, 0.1)', color: '#0a6fd8', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Trade Completed
                </button>
              )}
            </div>
          </div>
        </div>

        <div ref={containerRef} className="sheet-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }} data-lenis-prevent="true" aria-live="polite">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>Say hi to discuss the trade!</div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_username === currentUser;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    background: isMe ? '#007aff' : 'var(--input-bg)',
                    color: isMe ? '#fff' : 'var(--text-main)',
                    padding: '10px 16px',
                    borderRadius: '20px',
                    borderBottomRightRadius: isMe ? '4px' : '20px',
                    borderBottomLeftRadius: isMe ? '20px' : '4px',
                    maxWidth: '75%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    fontSize: '0.95rem',
                    opacity: msg.pending ? 0.6 : 1,
                    overflowWrap: 'anywhere'
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {chatNotice && <div className="trade-notice" role="alert" style={{ margin: '0 20px 10px' }}>{chatNotice}</div>}

        <form onSubmit={onSend} style={{ padding: '15px 20px', background: 'var(--card-bg, transparent)', borderTop: '1px solid var(--border-medium)', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => onInputChange(e.target.value)}
            placeholder="Type a message..."
            aria-label="Message"
            maxLength={1000}
            autoComplete="off"
            style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', fontSize: '1rem' }}
          />
          <button type="submit" aria-label="Send message" style={{ background: '#007aff', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} disabled={!chatInput.trim() || sending}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}

const TradingCenter = ({ onRequestLogin, onOpenProfile, isActive = true }) => {
  const { user, cards, getCard, wishlist, profile, authFetch } = useAppContext();
  // In-game ID lives on the Profile page; Trading just reads it.
  const inGameId = profile?.inGameId || '';

  const [activeTab, setActiveTab] = useState('listing'); // 'listing' or 'matches'

  const [offering, setOffering] = useState([]);
  const [requesting, setRequesting] = useState([]);
  const [listingState, setListingState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [saveState, setSaveState] = useState('saved');         // 'saved' | 'saving' | 'error'

  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMode, setSearchMode] = useState(null); // 'offering' or 'requesting'

  const [chatUser, setChatUser] = useState(null); // a match: { userId, username, inGameId, ... }
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatNotice, setChatNotice] = useState('');
  const [sending, setSending] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [myReputation, setMyReputation] = useState(0);
  const [notice, setNotice] = useState('');

  const chatContainerRef = useRef(null);
  const activeChatId = useRef(null);      // which conversation responses should be applied to
  const listingRef = useRef({ offering: [], requesting: [] });
  const saveTimer = useRef(null);
  const saveSeq = useRef(0);

  // ---- reset everything when the account changes or signs out -------------
  useEffect(() => {
    clearTimeout(saveTimer.current);
    activeChatId.current = null;
    setOffering([]);
    setRequesting([]);
    listingRef.current = { offering: [], requesting: [] };
    setListingState('loading');
    setSaveState('saved');
    setMatches([]);
    setMatchesError(false);
    setChatUser(null);
    setMessages([]);
    setChatInput('');
    setChatNotice('');
    setSearchMode(null);
    setUnreadCount(0);
    setMyReputation(0);
    setNotice('');
    setActiveTab('listing');
  }, [user]);

  // The sheets are full-screen overlays: keep the page behind them from scrolling.
  const sheetOpen = !!searchMode || !!chatUser;
  useEffect(() => {
    if (!sheetOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  // ---- loading the user's listing and reputation --------------------------
  const loadListing = useCallback(async () => {
    setListingState('loading');
    try {
      const res = await authFetch('/trade');
      const data = await readJson(res);
      if (!res.ok || !data || !Array.isArray(data.offering_cards) || !Array.isArray(data.requesting_cards)) {
        throw new Error(`listing request failed (${res.status})`);
      }
      setOffering(data.offering_cards);
      setRequesting(data.requesting_cards);
      listingRef.current = { offering: data.offering_cards, requesting: data.requesting_cards };
      setListingState('ready');
    } catch (e) {
      console.error('Could not load the trade listing', e);
      setListingState('error');
    }
  }, [authFetch]);

  const loadReputation = useCallback(async () => {
    try {
      const res = await authFetch('/user');
      const data = await readJson(res);
      if (res.ok && data) setMyReputation(data.successfulTrades || 0);
    } catch (e) {
      console.error('Could not load reputation', e);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!user) return;
    loadListing();
    loadReputation();
  }, [user, loadListing, loadReputation]);

  // ---- saving the listing (debounced, latest state wins) ------------------
  const saveListingNow = useCallback(async () => {
    const seq = ++saveSeq.current;
    const { offering: o, requesting: r } = listingRef.current;
    setSaveState('saving');
    try {
      const res = await authFetch('/trade', { method: 'POST', json: { offering_cards: o, requesting_cards: r } });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      if (seq === saveSeq.current) setSaveState('saved');
    } catch (e) {
      console.error('Could not save the trade listing', e);
      if (seq === saveSeq.current) setSaveState('error');
    }
  }, [authFetch]);

  const updateListing = useCallback((nextOffering, nextRequesting) => {
    setOffering(nextOffering);
    setRequesting(nextRequesting);
    listingRef.current = { offering: nextOffering, requesting: nextRequesting };
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveListingNow, LISTING_SAVE_DELAY_MS);
  }, [saveListingNow]);

  // Don't lose a pending change if the page is left before the debounce fires.
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // ---- notifications -------------------------------------------------------
  // The app keeps every page mounted (just hidden) after the first visit, so the
  // poll only runs while this tab is actually the visible one.
  useEffect(() => {
    if (!(user && isActive)) return undefined;
    let cancelled = false;

    const fetchNotifications = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await authFetch('/trade/notifications');
        const data = await readJson(res);
        if (!cancelled && res.ok && data) setUnreadCount(data.unreadCount || 0);
      } catch (e) {
        console.error('fetchNotifications error:', e);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIFICATION_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, isActive, authFetch]);

  // ---- matches -------------------------------------------------------------
  const fetchMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatchesError(false);
    try {
      const res = await authFetch('/trade/matches');
      const data = await readJson(res);
      if (!res.ok || !Array.isArray(data)) throw new Error(`matches request failed (${res.status})`);
      setMatches(data);
    } catch (e) {
      console.error('fetchMatches error:', e);
      setMatches([]);
      setMatchesError(true);
    } finally {
      setLoadingMatches(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeTab === 'matches' && user) fetchMatches();
  }, [activeTab, user, fetchMatches]);

  // ---- card search ---------------------------------------------------------
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 2 && cards) {
      setSearchResults(cards.filter(c => c.name.toLowerCase().includes(q)).slice(0, 20));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, cards]);

  const closeSearch = () => { setSearchMode(null); setSearchQuery(''); };

  const toggleCard = (mode, cardId) => {
    if (listingState !== 'ready') return;
    const list = mode === 'offering' ? offering : requesting;
    const nextList = list.includes(cardId) ? list.filter(id => id !== cardId) : [...list, cardId];
    if (mode === 'offering') updateListing(nextList, requesting);
    else updateListing(offering, nextList);
  };

  const importWishlist = () => {
    if (listingState !== 'ready') return;
    const wished = Object.keys(wishlist).filter(k => wishlist[k]);
    updateListing(offering, Array.from(new Set([...requesting, ...wished])));
  };

  // ---- chat ----------------------------------------------------------------
  const scrollChatToBottom = () => {
    requestAnimationFrame(() => {
      const el = chatContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const fetchMessages = useCallback(async (targetUserId, { scroll = true } = {}) => {
    try {
      const res = await authFetch(`/chat/${targetUserId}`);
      const data = await readJson(res);
      if (activeChatId.current !== targetUserId) return; // the person moved on to another chat (or closed it)
      if (!res.ok || !Array.isArray(data)) throw new Error(`chat request failed (${res.status})`);
      setMessages(data);
      if (scroll) scrollChatToBottom();
    } catch (e) {
      console.error('fetchMessages error:', e);
    }
  }, [authFetch]);

  const openChat = (match) => {
    activeChatId.current = match.userId;
    setChatUser(match);
    setMessages([]);
    setChatInput('');
    setChatNotice('');
    fetchMessages(match.userId);
  };

  const closeChat = useCallback(() => {
    activeChatId.current = null;
    setChatUser(null);
    setMessages([]);
    setChatNotice('');
  }, []);

  // Keep the open conversation fresh (only while it is visible on screen).
  useEffect(() => {
    if (!chatUser || !isActive) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') fetchMessages(chatUser.userId, { scroll: false });
    }, CHAT_POLL_MS);
    return () => clearInterval(interval);
  }, [chatUser, isActive, fetchMessages]);

  // Leaving the tab closes the conversation.
  useEffect(() => {
    if (!isActive && chatUser) closeChat();
  }, [isActive, chatUser, closeChat]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content || !chatUser || sending) return;

    const targetId = chatUser.userId;
    const tempId = `pending-${Date.now()}`;
    setSending(true);
    setChatNotice('');
    setChatInput('');
    setMessages(prev => [...prev, { id: tempId, sender_username: user, content, pending: true }]);
    scrollChatToBottom();

    try {
      const res = await authFetch(`/chat/${targetId}`, { method: 'POST', json: { content } });
      if (!res.ok) {
        const data = await readJson(res);
        throw new Error(data?.error || 'Message not sent');
      }
      await fetchMessages(targetId);
    } catch (err) {
      if (activeChatId.current === targetId) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setChatInput(content); // give the text back so nothing is lost
        setChatNotice(err.message || 'Message not sent. Check your connection and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const endorseTrader = async (targetUserId) => {
    setChatNotice('');
    try {
      const res = await authFetch(`/trade/endorse/${targetUserId}`, { method: 'POST' });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || 'Could not endorse this trader');
      setChatUser(prev => (prev ? { ...prev, successfulTrades: (prev.successfulTrades || 0) + 1 } : prev));
      setMatches(prev => prev.map(m => (m.userId === targetUserId ? { ...m, successfulTrades: (m.successfulTrades || 0) + 1 } : m)));
      setNotice('Endorsement sent. Thanks for keeping trading friendly!');
    } catch (err) {
      setChatNotice(err.message);
    }
  };

  const completeTrade = async () => {
    if (!chatUser) return;
    // Remove the traded cards from both lists.
    const nextOffering = offering.filter(cardId => !chatUser.iGiveTheyWant.includes(cardId));
    const nextRequesting = requesting.filter(cardId => !chatUser.theyGiveIWant.includes(cardId));
    updateListing(nextOffering, nextRequesting);
    closeChat();
    setNotice('Trade completed. The traded cards were removed from your listing.');
    setTimeout(fetchMatches, LISTING_SAVE_DELAY_MS + 300); // after the listing has been saved
  };

  // ---- render --------------------------------------------------------------
  if (!user) {
    return (
      <div className="collection-page animate-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>Global Trading Hub</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '40px', textAlign: 'center' }}>Sign in to list your cards and find trading partners globally.</p>
        <button className="btn-super" onClick={onRequestLogin}>Sign In to Trade</button>
      </div>
    );
  }

  const listingLocked = listingState !== 'ready';

  const renderCardGrid = (cardIds, mode) => {
    if (listingState === 'loading') return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your listing…</div>;
    if (!cardIds.length) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No cards selected.</div>;
    return (
      <div className="collection-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
        {cardIds.map(id => {
          const { set, num } = parseCardId(id);
          const card = getCard(set, num);
          if (!card) return null;
          return (
            <button
              type="button"
              key={id}
              style={{ position: 'relative', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'inherit' }}
              onClick={() => toggleCard(mode, id)}
              aria-label={`Remove ${card.name} from your list`}
            >
              <PokemonCard card={card} />
              <div style={{ position: 'absolute', top: -5, right: -5, background: '#ff3b30', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderMatchCards = (ids) => ids.map(id => {
    const { set, num } = parseCardId(id);
    const card = getCard(set, num);
    return card ? <div key={id} style={{ width: 60, flexShrink: 0 }}><PokemonCard card={card} /></div> : null;
  });

  return (
    <>
      <div className="collection-page animate-enter">
        <div className="glass-panel trade-header" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #0a84ff, #30d158)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}>
            <ArrowRightLeft color="white" size={40} aria-hidden="true" />
          </div>
          <div className="trade-header-text" style={{ flex: 1 }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Trading Center</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '8px', fontWeight: 500 }}>
              List your dupes, specify what you need, and the engine will find perfect matches.
            </p>
          </div>

          <div className="trade-endorse" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,214,10,0.1)', padding: '12px 24px', borderRadius: '20px', border: '1px solid rgba(255,214,10,0.2)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffd60a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Endorsements</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffd60a', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>
              <Star size={26} fill="currentColor" aria-hidden="true" /> {myReputation}
            </div>
          </div>
        </div>

        <div className="trade-toolbar" style={{ marginBottom: '30px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div className="trade-tabs" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="apple-segmented-control" role="tablist" aria-label="Trading views" style={{ width: 'auto' }}>
              <button role="tab" aria-selected={activeTab === 'listing'} className={`segmented-btn ${activeTab === 'listing' ? 'active' : ''}`} onClick={() => setActiveTab('listing')}>My Listing</button>
              <button role="tab" aria-selected={activeTab === 'matches'} className={`segmented-btn ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
            </div>
            <button
              type="button"
              className="trade-bell"
              onClick={() => setActiveTab('matches')}
              aria-label={unreadCount > 0 ? `${unreadCount} unread conversations` : 'No unread messages'}
              style={{ position: 'relative', cursor: 'pointer', padding: '10px', background: 'none', border: 'none' }}
            >
              <Bell size={24} color={unreadCount > 0 ? '#ff3b30' : 'var(--text-muted)'} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 5, right: 5, background: '#ff3b30', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="trade-id-btn"
            onClick={onOpenProfile}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: inGameId ? 'rgba(128,128,140,0.14)' : 'rgba(255,149,0,0.12)', padding: '8px 20px', borderRadius: '20px', border: `1px solid ${inGameId ? 'rgba(128,128,140,0.25)' : 'rgba(255,149,0,0.5)'}`, cursor: 'pointer', color: 'var(--text-main)', fontSize: '1rem' }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>In-Game ID:</span>
            {inGameId ? (
              <>
                <span style={{ fontWeight: 700 }}>{inGameId}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Edit</span>
              </>
            ) : (
              <span style={{ fontWeight: 700, color: '#ff9500' }}>Add your ID in Profile →</span>
            )}
          </button>
        </div>

        {notice && (
          <div className="trade-notice success" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button>
          </div>
        )}

        {listingState === 'error' && (
          <div className="trade-notice" role="alert">
            <span>We couldn't load your listing, so editing is paused to protect what you've saved.</span>
            <button type="button" className="trade-notice-action" onClick={loadListing}>Try again</button>
          </div>
        )}
        {saveState === 'error' && (
          <div className="trade-notice" role="alert">
            <span>Your latest change hasn't been saved yet.</span>
            <button type="button" className="trade-notice-action" onClick={saveListingNow}>Retry</button>
          </div>
        )}

        {activeTab === 'listing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Offering Section */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="trade-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Cards I'm Offering</h3>
                <button className="btn-super" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={listingLocked} onClick={() => setSearchMode('offering')}>+ Add Cards</button>
              </div>
              {renderCardGrid(offering, 'offering')}
            </div>

            {/* Requesting Section */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="trade-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Cards I Want</h3>
                <div className="trade-section-actions" style={{ display: 'flex', gap: '10px' }}>
                  <button className="nav-pill" style={{ background: 'rgba(255, 45, 85, 0.1)', color: '#ff2d55', fontWeight: 700 }} disabled={listingLocked} onClick={importWishlist}>
                    <Heart size={16} fill="currentColor" style={{ marginRight: '6px' }} aria-hidden="true" /> Import Wishlist
                  </button>
                  <button className="btn-super" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={listingLocked} onClick={() => setSearchMode('requesting')}>+ Add Cards</button>
                </div>
              </div>
              {renderCardGrid(requesting, 'requesting')}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {loadingMatches ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Finding perfect trades...</div>
            ) : matchesError ? (
              <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '10px' }}>We couldn't load your matches.</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Check your connection and try again.</p>
                <button className="btn-super" style={{ padding: '10px 22px' }} onClick={fetchMatches}>Try again</button>
              </div>
            ) : matches.length === 0 ? (
              <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }} aria-hidden="true">🔍</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>No matches found yet.</h3>
                <p style={{ color: 'var(--text-muted)' }}>Try offering more cards or check back later as more users join.</p>
              </div>
            ) : (
              matches.map(m => (
                <div key={m.userId} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="trade-match-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3B30, #FF2D55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', position: 'relative' }}>
                        {m.username.charAt(0).toUpperCase()}
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: isOnline(m.lastActive) ? '#34c759' : '#8e8e93', border: '2px solid var(--bg-main)' }}></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{m.username}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,214,10,0.15)', color: '#b38f00', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                            <Star size={12} fill="currentColor" /> {m.successfulTrades || 0}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ID: {m.inGameId || 'Not provided'}</div>
                      </div>
                    </div>
                    <button className="btn-super" style={{ background: '#0a84ff', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} onClick={() => openChat(m)}>
                      <MessageCircle size={18} aria-hidden="true" /> Chat
                      {m.unreadMessages > 0 && (
                        <span style={{ position: 'absolute', top: -5, right: -5, background: '#ff3b30', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                          {m.unreadMessages}
                        </span>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1f9d45', marginBottom: '10px', textTransform: 'uppercase' }}>They give (You want):</div>
                      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px' }}>{renderMatchCards(m.theyGiveIWant)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e0352b', marginBottom: '10px', textTransform: 'uppercase' }}>They want (You give):</div>
                      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px' }}>{renderMatchCards(m.iGiveTheyWant)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {searchMode && (
        <SearchSheet
          mode={searchMode}
          searchQuery={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          selectedIds={searchMode === 'offering' ? offering : requesting}
          onToggle={toggleCard}
          onClose={closeSearch}
        />
      )}

      {chatUser && (
        <ChatSheet
          chatUser={chatUser}
          currentUser={user}
          messages={messages}
          chatInput={chatInput}
          onInputChange={setChatInput}
          onSend={sendMessage}
          sending={sending}
          chatNotice={chatNotice}
          onClose={closeChat}
          onEndorse={endorseTrader}
          onComplete={completeTrade}
          containerRef={chatContainerRef}
        />
      )}
    </>
  );
};

export default TradingCenter;
