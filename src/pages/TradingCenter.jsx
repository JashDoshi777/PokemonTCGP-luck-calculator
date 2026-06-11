import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import PokemonCard from '../components/PokemonCard';
import { Search, X, Check, MessageCircle, Heart, ArrowRightLeft, Bell, Star } from 'lucide-react';
import './CollectionTracker.css'; // Reuse existing styles where possible

const TradingCenter = ({ onRequestLogin }) => {
  const { user, cards, wishlist, token } = useAppContext();
  const [activeTab, setActiveTab] = useState('listing'); // 'listing' or 'matches'
  
  const [inGameId, setInGameId] = useState('');
  const [offering, setOffering] = useState([]);
  const [requesting, setRequesting] = useState([]);
  
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMode, setSearchMode] = useState(null); // 'offering' or 'requesting'
  
  const [chatUser, setChatUser] = useState(null); // { userId, username, inGameId }
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const chatPollRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [myReputation, setMyReputation] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (user && token) {
      fetchUserData();
      fetchTradeListing();
      
      const fetchNotifications = async () => {
        try {
          const res = await fetch(`${API_URL}/trade/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        } catch (e) {
          console.error('fetchNotifications error:', e);
        }
      };
      
      fetchNotifications();
      const notifInterval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(notifInterval);
    }
  }, [user, token]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API_URL}/user`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.inGameId) setInGameId(data.inGameId);
      if (data.successfulTrades) setMyReputation(data.successfulTrades);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTradeListing = async () => {
    try {
      const res = await fetch(`${API_URL}/trade`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setOffering(data.offering_cards || []);
      setRequesting(data.requesting_cards || []);
    } catch (e) {
      console.error(e);
    }
  };

  const saveTradeListing = async (newOffering, newRequesting) => {
    try {
      const res = await fetch(`${API_URL}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ offering_cards: newOffering, requesting_cards: newRequesting })
      });
      if (!res.ok) {
        console.error('saveTradeListing failed:', res.status, await res.text());
      } else {
        console.log('Trade listing saved successfully');
      }
    } catch (e) {
      console.error('saveTradeListing error:', e);
    }
  };

  const saveInGameId = async () => {
    try {
      await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ inGameId })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch(`${API_URL}/trade/matches`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        console.error('fetchMatches failed:', res.status, await res.text());
        setMatches([]);
      } else {
        const data = await res.json();
        console.log('Matches found:', data);
        setMatches(data || []);
      }
    } catch (e) {
      console.error('fetchMatches error:', e);
    }
    setLoadingMatches(false);
  };

  useEffect(() => {
    if (activeTab === 'matches' && user) {
      fetchMatches();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (searchMode || chatUser) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [searchMode, chatUser]);

  useEffect(() => {
    if (searchQuery.trim().length > 2 && cards) {
      const q = searchQuery.toLowerCase();
      setSearchResults(cards.filter(c => c.name.toLowerCase().includes(q)).slice(0, 20));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, cards]);

  const toggleCard = (mode, cardId) => {
    const list = mode === 'offering' ? offering : requesting;
    const setList = mode === 'offering' ? setOffering : setRequesting;
    
    let newList;
    if (list.includes(cardId)) {
      newList = list.filter(id => id !== cardId);
    } else {
      newList = [...list, cardId];
    }
    setList(newList);
    
    if (mode === 'offering') {
      saveTradeListing(newList, requesting);
    } else {
      saveTradeListing(offering, newList);
    }
  };

  const importWishlist = () => {
    const wList = Object.keys(wishlist).filter(k => wishlist[k]);
    const newList = Array.from(new Set([...requesting, ...wList]));
    setRequesting(newList);
    saveTradeListing(offering, newList);
  };

  // --- CHAT LOGIC ---
  const startChat = (match) => {
    setChatUser(match);
    fetchMessages(match.userId);
    chatPollRef.current = setInterval(() => {
      fetchMessages(match.userId, false);
    }, 5000);
  };

  const closeChat = () => {
    setChatUser(null);
    setMessages([]);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
  };

  const fetchMessages = async (targetUserId, scrollToBottom = true) => {
    try {
      const res = await fetch(`${API_URL}/chat/${targetUserId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setMessages(data);
      if (scrollToBottom && chatContainerRef.current) {
        setTimeout(() => chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight, 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatUser) return;
    const msg = chatInput.trim();
    setChatInput('');
    
    // Optimistic UI
    setMessages(prev => [...prev, { id: Date.now(), sender_username: user, content: msg }]);
    setTimeout(() => chatContainerRef.current && (chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight), 50);

    try {
      await fetch(`${API_URL}/chat/${chatUser.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: msg })
      });
      fetchMessages(chatUser.userId);
    } catch (e) {
      console.error(e);
    }
  };

  const endorseTrader = async (targetUserId) => {
    try {
      const res = await fetch(`${API_URL}/trade/endorse/${targetUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChatUser(prev => ({ ...prev, successfulTrades: (prev.successfulTrades || 0) + 1 }));
        setMatches(prev => prev.map(m => m.userId === targetUserId ? { ...m, successfulTrades: (m.successfulTrades || 0) + 1 } : m));
      } else {
        alert(data.error || "Could not endorse");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const completeTrade = async () => {
    if (!chatUser) return;
    if (!confirm("This will remove the traded cards from your listing. Continue?")) return;

    // Remove the matching cards from offering and requesting
    const newOffering = offering.filter(cardId => !chatUser.iGiveTheyWant.includes(cardId));
    const newRequesting = requesting.filter(cardId => !chatUser.theyGiveIWant.includes(cardId));
    
    setOffering(newOffering);
    setRequesting(newRequesting);
    
    // Save to backend
    await saveTradeListing(newOffering, newRequesting);
    
    // Re-fetch matches so this match disappears
    fetchMatches();
    
    // Close the chat
    closeChat();
    alert("Trade completed! Cards removed from your listing.");
  };

  useEffect(() => {
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, []);

  if (!user) {
    return (
      <div className="collection-page animate-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>Global Trading Hub</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '40px', textAlign: 'center' }}>Sign in to list your cards and find trading partners globally.</p>
        <button className="btn-super" onClick={onRequestLogin}>Sign In to Trade</button>
      </div>
    );
  }

  const renderCardGrid = (cardIds, mode) => {
    if (!cardIds.length) return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>No cards selected.</div>;
    return (
      <div className="collection-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
        {cardIds.map(id => {
          const [set, num] = id.split('-');
          const card = cards?.find(c => c.set === set && c.number.toString() === num);
          if (!card) return null;
          return (
            <div key={id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggleCard(mode, id)}>
              <PokemonCard card={card} />
              <div style={{ position: 'absolute', top: -5, right: -5, background: '#ff3b30', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isOnline = (secondsSinceActive) => {
    if (secondsSinceActive === null || secondsSinceActive === undefined) return false;
    return secondsSinceActive < 5 * 60; // 5 mins in seconds
  };

  return (
    <>
      <div className="collection-page animate-enter">
        <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #0a84ff, #30d158)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}>
          <ArrowRightLeft color="white" size={40} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Trading Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '8px', fontWeight: 500 }}>
            List your dupes, specify what you need, and the engine will find perfect matches.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,214,10,0.1)', padding: '12px 24px', borderRadius: '20px', border: '1px solid rgba(255,214,10,0.2)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffd60a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Endorsements</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffd60a', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>
            <Star size={26} fill="currentColor" /> {myReputation}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '30px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="apple-segmented-control" style={{ width: 'auto' }}>
            <button className={`segmented-btn ${activeTab === 'listing' ? 'active' : ''}`} onClick={() => setActiveTab('listing')}>My Listing</button>
            <button className={`segmented-btn ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
          </div>
          <div style={{ position: 'relative', cursor: 'pointer', padding: '10px' }} onClick={() => setActiveTab('matches')}>
            <Bell size={24} color={unreadCount > 0 ? '#ff3b30' : 'var(--text-muted)'} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 5, background: '#ff3b30', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>In-Game ID:</span>
          <input 
            type="text" 
            value={inGameId || ''}
            onChange={e => setInGameId(e.target.value)}
            onBlur={saveInGameId}
            placeholder="e.g. 1234-5678-9012"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, width: '200px', color: 'var(--text-main)', fontSize: '1rem' }}
          />
        </div>
      </div>

      {activeTab === 'listing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Offering Section */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Cards I'm Offering</h3>
              <button className="btn-super" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setSearchMode('offering')}>+ Add Cards</button>
            </div>
            {renderCardGrid(offering, 'offering')}
          </div>

          {/* Requesting Section */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Cards I Want</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="nav-pill" style={{ background: 'rgba(255, 45, 85, 0.1)', color: '#ff2d55', fontWeight: 700 }} onClick={importWishlist}>
                  <Heart size={16} fill="currentColor" style={{ marginRight: '6px' }}/> Import Wishlist
                </button>
                <button className="btn-super" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setSearchMode('requesting')}>+ Add Cards</button>
              </div>
            </div>
            {renderCardGrid(requesting, 'requesting')}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {loadingMatches ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Finding perfect trades...</div>
          ) : matches.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔍</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>No matches found yet.</h3>
              <p style={{ color: 'var(--text-muted)' }}>Try offering more cards or check back later as more users join.</p>
            </div>
          ) : (
            matches.map(m => (
              <div key={m.userId} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3B30, #FF2D55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', position: 'relative' }}>
                      {m.username.charAt(0).toUpperCase()}
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: isOnline(m.lastActive) ? '#34c759' : '#8e8e93', border: '2px solid var(--bg-main)' }}></div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{m.username}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,214,10,0.15)', color: '#ffd60a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                          <Star size={12} fill="currentColor" /> {m.successfulTrades || 0}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ID: {m.inGameId || 'Not provided'}</div>
                    </div>
                  </div>
                  <button className="btn-super" style={{ background: '#0a84ff', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} onClick={() => startChat(m)}>
                    <MessageCircle size={18} /> Chat
                    {m.unreadMessages > 0 && (
                      <span style={{ position: 'absolute', top: -5, right: -5, background: '#ff3b30', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                        {m.unreadMessages}
                      </span>
                    )}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759', marginBottom: '10px', textTransform: 'uppercase' }}>They give (You want):</div>
                    <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px' }}>
                      {m.theyGiveIWant.map(id => {
                        const [set, num] = id.split('-');
                        const card = cards?.find(c => c.set === set && c.number.toString() === num);
                        return card ? <div key={id} style={{ width: 60, flexShrink: 0 }}><PokemonCard card={card} /></div> : null;
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff3b30', marginBottom: '10px', textTransform: 'uppercase' }}>They want (You give):</div>
                    <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px' }}>
                      {m.iGiveTheyWant.map(id => {
                        const [set, num] = id.split('-');
                        const card = cards?.find(c => c.set === set && c.number.toString() === num);
                        return card ? <div key={id} style={{ width: 60, flexShrink: 0 }}><PokemonCard card={card} /></div> : null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </div>

      {/* Card Search Modal */}
      {searchMode && (
        <div className="ios-backdrop" onClick={() => setSearchMode(null)} data-lenis-prevent="true">
          <div className="ios-bottom-sheet" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <div className="drag-indicator"></div>
              <button className="ios-close-btn" onClick={() => setSearchMode(null)}>
                <X size={12} />
              </button>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Search Cards to {searchMode === 'offering' ? 'Offer' : 'Request'}</h2>
            </div>
            <div className="sheet-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }} data-lenis-prevent="true">
              <div style={{ padding: '0px 20px 10px' }}>
                <div className="apple-search-input-wrapper active">
                  <Search size={20} className="apple-search-icon" />
                  <input 
                    autoFocus
                    type="text"
                    className="apple-search-input"
                    placeholder="Search by Pokémon name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ color: 'var(--text-main)' }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 40px', minHeight: 0 }} data-lenis-prevent="true">
                <div className="collection-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                  {searchResults.map(card => {
                    const id = `${card.set}-${card.number}`;
                    const list = searchMode === 'offering' ? offering : requesting;
                    const isSelected = list.includes(id);
                    return (
                      <div key={id} style={{ position: 'relative', cursor: 'pointer', opacity: isSelected ? 0.5 : 1, transition: '0.2s' }} onClick={() => toggleCard(searchMode, id)}>
                        <PokemonCard card={card} />
                        {isSelected && (
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#34c759', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            <Check size={20} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatUser && (
        <div className="ios-backdrop" onClick={closeChat} data-lenis-prevent="true">
          <div className="ios-bottom-sheet" style={{ height: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <div className="drag-indicator"></div>
              <button className="ios-close-btn" onClick={closeChat}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,214,10,0.15)', color: '#ffd60a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                      <Star size={12} fill="currentColor" /> {chatUser.successfulTrades || 0}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isOnline(chatUser.lastActive) ? 'Online now' : 'Offline'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => endorseTrader(chatUser.userId)} style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={14} fill="currentColor" /> Endorse
                  </button>
                  <button onClick={completeTrade} style={{ background: 'rgba(0, 122, 255, 0.1)', color: '#0a84ff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Trade Completed
                  </button>
                </div>
              </div>
            </div>
            
            <div ref={chatContainerRef} className="sheet-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }} data-lenis-prevent="true">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>Say hi to discuss the trade!</div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_username === user;
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
                        fontSize: '0.95rem'
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <form onSubmit={sendMessage} style={{ padding: '15px 20px', background: 'var(--card-bg, transparent)', borderTop: '1px solid var(--border-medium)', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', fontSize: '1rem' }}
              />
              <button type="submit" style={{ background: '#007aff', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} disabled={!chatInput.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TradingCenter;
