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
        
        const savedCollection = localStorage.getItem('tcgp_collection');
        if (savedCollection) setCollection(JSON.parse(savedCollection));
        
        const savedWishlist = localStorage.getItem('tcgp_wishlist');
        if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
        
        const savedDecks = localStorage.getItem('tcgp_decks');
        if (savedDecks) setCustomDecks(JSON.parse(savedDecks));

        // If logged in, fetch from cloud
        if (token) {
          try {
            const res = await fetch(`${API_URL}/sync`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.collection) {
                setCollection(data.collection);
                localStorage.setItem('tcgp_collection', JSON.stringify(data.collection));
              }
              if (data.wishlist) {
                setWishlist(data.wishlist);
                localStorage.setItem('tcgp_wishlist', JSON.stringify(data.wishlist));
              }
              if (data.customDecks) {
                let parsedDecks = data.customDecks;
                if (typeof parsedDecks === 'string') {
                  try { parsedDecks = JSON.parse(parsedDecks); } catch(e) { parsedDecks = []; }
                }
                if (!Array.isArray(parsedDecks)) parsedDecks = [];
                setCustomDecks(parsedDecks);
                localStorage.setItem('tcgp_decks', JSON.stringify(parsedDecks));
              }
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
        await fetch(`${API_URL}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ collection, wishlist, customDecks })
        });
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
    localStorage.setItem('tcgp_token', data.token);
    localStorage.setItem('tcgp_user', data.username);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
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
      login,
      register,
      logout,
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
