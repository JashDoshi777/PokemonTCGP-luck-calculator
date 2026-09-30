import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataService } from '../services/DataService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [data, setData] = useState({ cards: [], sets: {}, rarities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User State
  const [user, setUser] = useState(localStorage.getItem('tcgp_user') || null);
  const [token, setToken] = useState(localStorage.getItem('tcgp_token') || null);
  const [collection, setCollection] = useState({}); // { cardId: count }
  const [wishlist, setWishlist] = useState({}); // { cardId: true }
  const [customDecks, setCustomDecks] = useState([]); // array of deck objects

  // Account profile (avatar, email, in-game ID, stats). Cached in localStorage so
  // the top bar can show the avatar instantly instead of waiting on the network.
  const [profile, setProfile] = useState(() => {
    try {
      if (!localStorage.getItem('tcgp_user')) return null;
      const raw = localStorage.getItem('tcgp_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (profile) localStorage.setItem('tcgp_profile', JSON.stringify(profile));
      else localStorage.removeItem('tcgp_profile');
    } catch {
      // storage unavailable - profile just isn't cached
    }
  }, [profile]);

  // API URL logic for serverless backend
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await dataService.initialize();
        const cards = await dataService.getCards();
        const setsRaw = await dataService.getSets();
        const rarities = await dataService.getRarities();
        
        // Flatten sets for easier access
        const flatSets = {};
        if (setsRaw) {
          Object.values(setsRaw).forEach(series => {
            series.forEach(set => {
              flatSets[set.code] = set;
            });
          });
        }

        setData({ cards: cards || [], sets: flatSets, rarities: rarities || [] });
        
        const safeParse = (raw, fallback) => {
          if (!raw) return fallback;
          try {
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
          } catch (e) {
            console.error('Corrupted local storage value, resetting:', e);
            return fallback;
          }
        };

        // Guards against a malformed cloud response (e.g. a serialization bug
        // returning something other than a {cardId: count} map) polluting the
        // merged collection/wishlist with garbage keys.
        const asPlainObject = (val, fallback) => {
          if (val && typeof val === 'object' && !Array.isArray(val)) return val;
          return fallback;
        };

        setCollection(safeParse(localStorage.getItem('tcgp_collection'), {}));
        setWishlist(safeParse(localStorage.getItem('tcgp_wishlist'), {}));
        setCustomDecks(safeParse(localStorage.getItem('tcgp_decks'), []));

        // If logged in, fetch from cloud
        if (token) {
          try {
            const res = await fetch(`${API_URL}/sync`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();

              // Safely merge guest data with cloud data
              const localCollection = safeParse(localStorage.getItem('tcgp_collection'), {});
              const mergedCollection = { ...localCollection, ...asPlainObject(data.collection, {}) };

              if (Object.keys(mergedCollection).length > 0) {
                setCollection(mergedCollection);
                localStorage.setItem('tcgp_collection', JSON.stringify(mergedCollection));
              }

              const localWishlist = safeParse(localStorage.getItem('tcgp_wishlist'), {});
              const mergedWishlist = { ...localWishlist, ...asPlainObject(data.wishlist, {}) };

              if (Object.keys(mergedWishlist).length > 0) {
                setWishlist(mergedWishlist);
                localStorage.setItem('tcgp_wishlist', JSON.stringify(mergedWishlist));
              }

              let parsedDecks = data.customDecks;
              if (typeof parsedDecks === 'string') {
                parsedDecks = safeParse(parsedDecks, []);
              }
              if (!Array.isArray(parsedDecks)) parsedDecks = [];

              const localDecks = safeParse(localStorage.getItem('tcgp_decks'), []);

              const deckMap = new Map();
              localDecks.forEach(d => { if (d && d.id) deckMap.set(d.id, d) });
              parsedDecks.forEach(d => { if (d && d.id) deckMap.set(d.id, d) });
              const mergedDecks = Array.from(deckMap.values());

              if (mergedDecks.length > 0) {
                setCustomDecks(mergedDecks);
                localStorage.setItem('tcgp_decks', JSON.stringify(mergedDecks));
              }
            } else if (res.status === 401 || res.status === 403) {
              // Token expired or invalid - drop it so the user isn't stuck silently logged in but unsynced.
              logout();
            }
          } catch (e) {
            console.error("Failed to sync from cloud", e);
          }
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  // Sync to cloud whenever collection, wishlist, or decks change
  useEffect(() => {
    if (!token || loading) return;
    const syncToCloud = async () => {
      try {
        const res = await fetch(`${API_URL}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ collection, wishlist, customDecks })
        });
        if (res.status === 401 || res.status === 403) {
          logout();
        }
      } catch (e) {
        console.error("Failed to sync to cloud", e);
      }
    };
    const timeout = setTimeout(syncToCloud, 2000); // Debounce sync
    return () => clearTimeout(timeout);
  }, [collection, wishlist, customDecks, token, loading]);

  // Auth Functions
  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setToken(data.token);
    setUser(data.username);
    setProfile({ username: data.username, avatar: data.avatar });
    localStorage.setItem('tcgp_token', data.token);
    localStorage.setItem('tcgp_user', data.username);
  };

  const register = async (username, password) => {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    setToken(data.token);
    setUser(data.username);
    setProfile({ username: data.username, avatar: data.avatar });
    localStorage.setItem('tcgp_token', data.token);
    localStorage.setItem('tcgp_user', data.username);
  };

  const refreshProfile = async () => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        logout();
        return null;
      }
      if (!res.ok) throw new Error('profile request failed');
      const data = await res.json();
      setProfile(data);
      return data;
    } catch (e) {
      console.error('Failed to load profile', e);
      return null;
    }
  };

  // Load the full profile (also backfills an avatar for accounts that predate
  // avatars) whenever a session starts or is restored. A failed load (network
  // blip, server restarting) is retried a couple of times so the avatar isn't
  // left blank until the next page refresh.
  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    let timer;
    const attempt = async (triesLeft) => {
      const result = await refreshProfile();
      if (!result && !cancelled && triesLeft > 0 && localStorage.getItem('tcgp_token')) {
        timer = setTimeout(() => attempt(triesLeft - 1), 3000);
      }
    };
    attempt(2);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token]);

  // Optimistic save: the UI updates immediately and rolls back if the server rejects it.
  const saveProfile = async (patch) => {
    if (!token) return { ok: false, error: 'Please sign in first' };
    const previous = profile;
    setProfile(prev => ({ ...(prev || {}), ...patch }));
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your changes');
      return { ok: true };
    } catch (e) {
      setProfile(previous);
      return { ok: false, error: e.message };
    }
  };

  // Remember the latest overall luck result on the account for the profile page.
  const saveLuckStat = ({ score, overallPct, packs }) => {
    if (!token) return;
    const luckLast = { score, percentile: Math.round(overallPct * 1000) / 10, packs };
    setProfile(prev => ({ ...(prev || {}), luckLast: { ...luckLast, at: new Date().toISOString() } }));
    fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ luckLast })
    }).catch(e => console.error('Failed to save luck stat', e));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setCollection({});
    setWishlist({});
    setCustomDecks([]);
    localStorage.removeItem('tcgp_token');
    localStorage.removeItem('tcgp_user');
    localStorage.removeItem('tcgp_collection');
    localStorage.removeItem('tcgp_wishlist');
    localStorage.removeItem('tcgp_decks');
  };

  // Collection functions
  const updateCardCount = (cardId, delta) => {
    setCollection(prev => {
      const next = { ...prev };
      const current = next[cardId] || 0;
      const newCount = Math.max(0, current + delta);
      
      if (newCount > 0) {
        next[cardId] = newCount;
      } else {
        delete next[cardId];
      }
      
      localStorage.setItem('tcgp_collection', JSON.stringify(next));
      return next;
    });
  };

  const batchUpdateCollection = (cardIds, delta) => {
    setCollection(prev => {
      const next = { ...prev };
      cardIds.forEach(cardId => {
        const current = next[cardId] || 0;
        const newCount = Math.max(0, current + delta);
        if (newCount > 0) {
          next[cardId] = newCount;
        } else {
          delete next[cardId];
        }
      });
      localStorage.setItem('tcgp_collection', JSON.stringify(next));
      return next;
    });
  };

  const toggleCardOwnership = (cardId, owned) => {
    setCollection(prev => {
      const next = { ...prev };
      if (owned) {
        next[cardId] = 1;
      } else {
        delete next[cardId];
      }
      localStorage.setItem('tcgp_collection', JSON.stringify(next));
      return next;
    });
  };

  const toggleWishlist = (cardId) => {
    setWishlist(prev => {
      const next = { ...prev };
      if (next[cardId]) {
        delete next[cardId];
      } else {
        next[cardId] = true;
      }
      localStorage.setItem('tcgp_wishlist', JSON.stringify(next));
      return next;
    });
  };

  // Deck functions
  const saveDeck = (deck) => {
    setCustomDecks(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const existingIdx = safePrev.findIndex(d => d && d.id === deck.id);
      let next;
      if (existingIdx >= 0) {
        next = [...safePrev];
        next[existingIdx] = deck;
      } else {
        next = [...safePrev, { ...deck, id: Date.now().toString() }];
      }
      localStorage.setItem('tcgp_decks', JSON.stringify(next));
      return next;
    });
  };

  const deleteDeck = (deckId) => {
    setCustomDecks(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const next = safePrev.filter(d => d && d.id !== deckId);
      localStorage.setItem('tcgp_decks', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AppContext.Provider value={{
      ...data,
      loading,
      error,
      user,
      token,
      login,
      register,
      logout,
      profile,
      refreshProfile,
      saveProfile,
      saveLuckStat,
      collection,
      wishlist,
      toggleCardOwnership,
      updateCardCount,
      batchUpdateCollection,
      toggleWishlist,
      customDecks,
      saveDeck,
      deleteDeck
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
