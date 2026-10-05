import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { dataService } from '../services/DataService';
import { local } from '../utils/storage';

const AppContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';

const KEYS = {
  token: 'tcgp_token',
  user: 'tcgp_user',
  profile: 'tcgp_profile',
  collection: 'tcgp_collection',
  wishlist: 'tcgp_wishlist',
  decks: 'tcgp_decks',
  owner: 'tcgp_data_owner', // which account the locally stored collection belongs to ('' = guest)
  dirty: 'tcgp_dirty'       // '1' while local edits haven't reached the server yet
};

const SYNC_DEBOUNCE_MS = 1500;
const SYNC_MAX_RETRIES = 6;

// ---------------------------------------------------------------------------
// Data shape helpers
// ---------------------------------------------------------------------------
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const plainObject = (v) => (isPlainObject(v) ? v : {});

// Decks are persisted as compact { set, number } references; older copies that
// embedded whole card objects are slimmed down on the way in.
const normalizeDecks = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map((deck) => ({
    id: String(deck.id ?? Date.now()),
    name: typeof deck.name === 'string' ? deck.name : 'Untitled Deck',
    type: typeof deck.type === 'string' ? deck.type : 'Custom',
    cards: (Array.isArray(deck.cards) ? deck.cards : [])
      .filter(c => isPlainObject(c) && c.set !== undefined && c.number !== undefined)
      .map(c => ({ set: c.set, number: c.number }))
  }));
};

const mergeCounts = (a, b) => {
  const out = { ...a };
  for (const [id, count] of Object.entries(b)) out[id] = Math.max(out[id] || 0, count || 0);
  return out;
};

const mergeDecks = (a, b) => {
  const byId = new Map();
  [...a, ...b].forEach(deck => byId.set(deck.id, deck));
  return [...byId.values()];
};

const snapshotOf = (collection, wishlist, decks) => JSON.stringify([collection, wishlist, decks]);

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

export const AppProvider = ({ children }) => {
  // Card catalog
  const [data, setData] = useState({ cards: [], sets: {}, rarities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Session
  const [user, setUser] = useState(() => local.get(KEYS.user));
  const [token, setToken] = useState(() => local.get(KEYS.token));
  const [sessionExpired, setSessionExpired] = useState(false);

  // User data. Restored synchronously so the UI has it on first paint.
  const [collection, setCollection] = useState(() => plainObject(local.getJSON(KEYS.collection, {})));
  const [wishlist, setWishlist] = useState(() => plainObject(local.getJSON(KEYS.wishlist, {})));
  const [customDecks, setCustomDecks] = useState(() => normalizeDecks(local.getJSON(KEYS.decks, [])));

  // Account profile (avatar, email, in-game ID, stats). Cached so the top bar
  // can show the avatar instantly instead of waiting on the network.
  const [profile, setProfile] = useState(() => {
    if (!local.get(KEYS.user)) return null;
    const cached = local.getJSON(KEYS.profile, null);
    return isPlainObject(cached) ? cached : null;
  });

  // Whether the initial download from the server has succeeded. Nothing is ever
  // uploaded before then, so a failed or slow first load can't overwrite the
  // account's saved data with an empty local copy.
  const [syncReady, setSyncReady] = useState(false);

  const tokenRef = useRef(token);
  const userRef = useRef(user);
  const stateRef = useRef({ collection, wishlist, customDecks });
  const profileRef = useRef(profile);
  const lastSyncedRef = useRef(null);
  const retryRef = useRef({ attempt: 0, timer: null });
  useEffect(() => { tokenRef.current = token; userRef.current = user; }, [token, user]);
  useEffect(() => { stateRef.current = { collection, wishlist, customDecks }; }, [collection, wishlist, customDecks]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ---- session helpers -----------------------------------------------------
  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setSyncReady(false);
    lastSyncedRef.current = null;
    clearTimeout(retryRef.current.timer);
    retryRef.current = { attempt: 0, timer: null };
    local.remove(KEYS.token);
    local.remove(KEYS.user);
    local.remove(KEYS.profile);
  }, []);

  // The login token lapsed or was rejected. Sign out but keep the local
  // collection (and its dirty flag) so unsynced edits can still be merged when
  // the same account signs back in.
  const expireSession = useCallback(() => {
    if (!tokenRef.current) return;
    clearSession();
    setSessionExpired(true);
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession();
    setSessionExpired(false);
    setCollection({});
    setWishlist({});
    setCustomDecks([]);
    [KEYS.collection, KEYS.wishlist, KEYS.decks, KEYS.owner, KEYS.dirty].forEach(k => local.remove(k));
  }, [clearSession]);

  // fetch() with the current login token; a 401 ends the session cleanly.
  const authFetch = useCallback(async (path, options = {}) => {
    const usedToken = tokenRef.current;
    const { json, headers = {}, ...rest } = options;
    const finalHeaders = { ...headers };
    if (usedToken) finalHeaders.Authorization = `Bearer ${usedToken}`;
    if (json !== undefined) finalHeaders['Content-Type'] = 'application/json';
    const network = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      ...(json !== undefined ? { body: JSON.stringify(json) } : {})
    });
    // Read the body right away and hand the caller an equivalent Response. Responses
    // that nobody reads (an error we only look at the status of, an abandoned
    // request) would otherwise keep their connection open.
    const res = [204, 205, 304].includes(network.status)
      ? network
      : new Response(await network.arrayBuffer(), { status: network.status, statusText: network.statusText, headers: network.headers });
    if (res.status === 401 && usedToken && tokenRef.current === usedToken) expireSession();
    return res;
  }, [expireSession]);

  // ---- card catalog --------------------------------------------------------
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const reloadCatalog = useCallback(() => setCatalogAttempt(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await dataService.initialize();
        const [cards, setsRaw, rarities] = await Promise.all([
          dataService.getCards(), dataService.getSets(), dataService.getRarities()
        ]);

        // Flatten sets for easier access
        const flatSets = {};
        if (setsRaw) {
          Object.values(setsRaw).forEach(series => {
            series.forEach(set => { flatSets[set.code] = set; });
          });
        }
        if (!cancelled) setData({ cards: cards || [], sets: flatSets, rarities: rarities || [] });
      } catch (err) {
        console.error('Failed to load the card catalog', err);
        if (!cancelled) setError(err.message || 'Could not load card data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogAttempt]);

  const cardIndex = useMemo(() => {
    const index = new Map();
    data.cards.forEach(card => index.set(`${card.set}-${card.number}`, card));
    return index;
  }, [data.cards]);

  const getCard = useCallback((set, number) => cardIndex.get(`${set}-${number}`) || null, [cardIndex]);

  // ---- local persistence ---------------------------------------------------
  useEffect(() => { local.setJSON(KEYS.collection, collection); }, [collection]);
  useEffect(() => { local.setJSON(KEYS.wishlist, wishlist); }, [wishlist]);
  useEffect(() => { local.setJSON(KEYS.decks, customDecks); }, [customDecks]);
  useEffect(() => {
    if (profile) local.setJSON(KEYS.profile, profile);
    else local.remove(KEYS.profile);
  }, [profile]);

  // Edits made after a session expired still belong to the old account; flag them so
  // they win over the server copy if that same account signs back in.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!tokenRef.current && local.get(KEYS.owner)) local.set(KEYS.dirty, '1');
  }, [collection, wishlist, customDecks]);

  // ---- cloud sync: download + reconcile ------------------------------------
  // Policy when a session starts:
  //  - local data already belongs to this account and is clean -> the server copy wins
  //    (so changes and deletions made on other devices arrive);
  //  - local data belongs to this account and has unsynced edits -> local wins;
  //  - local data is a guest's (or unowned) -> merged into the account (highest count per card);
  //  - local data belongs to some other account -> discarded.
  useEffect(() => {
    if (!token || !user) return undefined;
    let cancelled = false;
    let retryTimer;
    // Aborting (rather than just ignoring) an abandoned download frees the connection.
    const controller = new AbortController();

    const download = async (attemptNumber) => {
      try {
        const res = await authFetch('/sync', { signal: controller.signal });
        if (cancelled) return;
        if (res.status === 401) return; // authFetch already ended the session
        if (!res.ok) throw new Error(`sync download failed (${res.status})`);
        const cloud = await readJson(res);
        if (cancelled) return;

        const cloudData = {
          collection: plainObject(cloud.collection),
          wishlist: plainObject(cloud.wishlist),
          decks: normalizeDecks(cloud.customDecks)
        };
        const current = {
          collection: stateRef.current.collection,
          wishlist: stateRef.current.wishlist,
          decks: stateRef.current.customDecks
        };
        const owner = local.get(KEYS.owner) ?? '';
        const dirty = local.get(KEYS.dirty) === '1';

        let next;
        if (owner === user) {
          next = dirty ? current : cloudData;
        } else if (owner === '') {
          next = {
            collection: mergeCounts(cloudData.collection, current.collection),
            wishlist: { ...cloudData.wishlist, ...current.wishlist },
            decks: mergeDecks(cloudData.decks, current.decks)
          };
        } else {
          next = cloudData;
        }

        lastSyncedRef.current = snapshotOf(cloudData.collection, cloudData.wishlist, cloudData.decks);
        local.set(KEYS.owner, user);
        setCollection(next.collection);
        setWishlist(next.wishlist);
        setCustomDecks(next.decks);
        setSyncReady(true);
      } catch (e) {
        if (cancelled) return;
        console.error('Could not load your saved data yet; will retry', e);
        if (attemptNumber < SYNC_MAX_RETRIES) {
          retryTimer = setTimeout(() => download(attemptNumber + 1), Math.min(30_000, 2000 * 2 ** attemptNumber));
        }
      }
    };
    download(0);

    const retryWhenOnline = () => { if (!lastSyncedRef.current) download(0); };
    window.addEventListener('online', retryWhenOnline);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(retryTimer);
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [token, user, authFetch]);

  // ---- cloud sync: upload --------------------------------------------------
  const push = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    const { collection: c, wishlist: w, customDecks: d } = stateRef.current;
    const sent = snapshotOf(c, w, d);
    if (sent === lastSyncedRef.current) return;

    const retry = retryRef.current;
    clearTimeout(retry.timer);
    try {
      const res = await authFetch('/sync', { method: 'POST', json: { collection: c, wishlist: w, customDecks: d } });
      if (res.ok) {
        lastSyncedRef.current = sent;
        retry.attempt = 0;
        const now = stateRef.current;
        if (snapshotOf(now.collection, now.wishlist, now.customDecks) === sent) local.remove(KEYS.dirty);
        return;
      }
      if (res.status === 401) return;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error('The server rejected the saved data', res.status, await readJson(res));
        return; // retrying the same payload can't help
      }
      throw new Error(`sync upload failed (${res.status})`);
    } catch (e) {
      if (tokenRef.current !== activeToken) return;
      if (retry.attempt < SYNC_MAX_RETRIES) {
        retry.attempt += 1;
        retry.timer = setTimeout(push, Math.min(60_000, 4000 * 2 ** (retry.attempt - 1)));
      } else {
        console.error('Giving up on syncing for now; will retry after the next change', e);
      }
    }
  }, [authFetch]);

  useEffect(() => {
    if (!syncReady || !token) return undefined;
    if (snapshotOf(collection, wishlist, customDecks) === lastSyncedRef.current) return undefined;
    local.set(KEYS.dirty, '1');
    const timer = setTimeout(push, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [collection, wishlist, customDecks, syncReady, token, push]);

  // Flush pending edits when the tab is hidden / closed, and when connectivity returns.
  useEffect(() => {
    if (!syncReady || !token) return undefined;
    const flush = () => {
      const { collection: c, wishlist: w, customDecks: d } = stateRef.current;
      if (snapshotOf(c, w, d) === lastSyncedRef.current) return;
      const body = JSON.stringify({ collection: c, wishlist: w, customDecks: d });
      // keepalive requests are capped at 64KB; larger payloads fall back to the normal retry path.
      if (body.length < 60_000 && tokenRef.current) {
        fetch(`${API_URL}/sync`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
          body
        }).catch(() => {});
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const onOnline = () => push();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [syncReady, token, push]);

  // ---- auth ----------------------------------------------------------------
  const completeAuth = useCallback((payload) => {
    setSessionExpired(false);
    setToken(payload.token);
    setUser(payload.username);
    setProfile({ username: payload.username, avatar: payload.avatar });
    local.set(KEYS.token, payload.token);
    local.set(KEYS.user, payload.username);
  }, []);

  const authRequest = useCallback(async (path, username, password, fallbackError) => {
    let res;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    const payload = await readJson(res);
    if (!res.ok) throw new Error(payload.error || (res.status >= 500 ? 'The server had a problem. Please try again in a moment.' : fallbackError));
    if (!payload.token || !payload.username) throw new Error(fallbackError);
    completeAuth(payload);
  }, [completeAuth]);

  const login = useCallback((username, password) => authRequest('/login', username, password, 'Login failed'), [authRequest]);
  const register = useCallback((username, password) => authRequest('/register', username, password, 'Registration failed'), [authRequest]);
  const dismissSessionNotice = useCallback(() => setSessionExpired(false), []);

  const refreshProfile = useCallback(async () => {
    const usedToken = tokenRef.current;
    if (!usedToken) return null;
    try {
      const res = await authFetch('/profile');
      if (!res.ok) throw new Error(`profile request failed (${res.status})`);
      const payload = await readJson(res);
      if (tokenRef.current !== usedToken) return null; // signed out / switched account meanwhile
      setProfile(payload);
      return payload;
    } catch (e) {
      console.error('Failed to load profile', e);
      return null;
    }
  }, [authFetch]);

  // Load the full profile (also backfills an avatar for accounts that predate
  // avatars) whenever a session starts or is restored. A failed load (network
  // blip, server restarting) is retried a couple of times so the avatar isn't
  // left blank until the next page refresh.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    let timer;
    const attempt = async (triesLeft) => {
      const result = await refreshProfile();
      if (!result && !cancelled && triesLeft > 0 && tokenRef.current) {
        timer = setTimeout(() => attempt(triesLeft - 1), 3000);
      }
    };
    attempt(2);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, refreshProfile]);

  // Optimistic save: the UI updates immediately and rolls back if the server rejects it.
  const saveProfile = useCallback(async (patch) => {
    if (!tokenRef.current) return { ok: false, error: 'Please sign in first' };
    const previous = profileRef.current;
    setProfile(prev => ({ ...(prev || {}), ...patch }));
    try {
      const res = await authFetch('/profile', { method: 'PUT', json: patch });
      const payload = await readJson(res);
      if (!res.ok) throw new Error(payload.error || 'Could not save your changes');
      return { ok: true };
    } catch (e) {
      setProfile(previous);
      return { ok: false, error: e.message };
    }
  }, [authFetch]);

  // Remember the latest overall luck result on the account for the profile page.
  const saveLuckStat = useCallback(({ score, overallPct, packs }) => {
    if (!tokenRef.current) return;
    const luckLast = { score, percentile: Math.round(overallPct * 1000) / 10, packs };
    setProfile(prev => ({ ...(prev || {}), luckLast: { ...luckLast, at: new Date().toISOString() } }));
    authFetch('/profile', { method: 'PUT', json: { luckLast } }).catch(e => console.error('Failed to save luck stat', e));
  }, [authFetch]);

  // ---- collection / wishlist / decks ---------------------------------------
  const applyDelta = (map, cardId, delta) => {
    const next = Math.max(0, (map[cardId] || 0) + delta);
    const out = { ...map };
    if (next > 0) out[cardId] = Math.min(next, 999);
    else delete out[cardId];
    return out;
  };

  const updateCardCount = useCallback((cardId, delta) => {
    setCollection(prev => applyDelta(prev, cardId, delta));
  }, []);

  const batchUpdateCollection = useCallback((cardIds, delta) => {
    setCollection(prev => cardIds.reduce((acc, cardId) => applyDelta(acc, cardId, delta), prev));
  }, []);

  const toggleCardOwnership = useCallback((cardId, owned) => {
    setCollection(prev => {
      const next = { ...prev };
      if (owned) next[cardId] = 1;
      else delete next[cardId];
      return next;
    });
  }, []);

  const toggleWishlist = useCallback((cardId) => {
    setWishlist(prev => {
      const next = { ...prev };
      if (next[cardId]) delete next[cardId];
      else next[cardId] = true;
      return next;
    });
  }, []);

  // Saves a new deck, or replaces the deck with the same id.
  const saveDeck = useCallback((deck) => {
    const [clean] = normalizeDecks([{ ...deck, id: deck.id ?? Date.now().toString() }]);
    setCustomDecks(prev => {
      const exists = prev.some(d => d.id === clean.id);
      return exists ? prev.map(d => (d.id === clean.id ? clean : d)) : [...prev, clean];
    });
    return clean;
  }, []);

  const deleteDeck = useCallback((deckId) => {
    setCustomDecks(prev => prev.filter(d => d.id !== String(deckId)));
  }, []);

  const value = useMemo(() => ({
    ...data,
    loading,
    error,
    reloadCatalog,
    user,
    token,
    sessionExpired,
    dismissSessionNotice,
    login,
    register,
    logout,
    authFetch,
    profile,
    refreshProfile,
    saveProfile,
    saveLuckStat,
    collection,
    wishlist,
    getCard,
    toggleCardOwnership,
    updateCardCount,
    batchUpdateCollection,
    toggleWishlist,
    customDecks,
    saveDeck,
    deleteDeck
  }), [data, loading, error, reloadCatalog, user, token, sessionExpired, dismissSessionNotice, login, register, logout, authFetch,
    profile, refreshProfile, saveProfile, saveLuckStat,
    collection, wishlist, getCard, toggleCardOwnership, updateCardCount, batchUpdateCollection, toggleWishlist,
    customDecks, saveDeck, deleteDeck]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
