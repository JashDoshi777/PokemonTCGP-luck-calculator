// Thin wrappers around localStorage / sessionStorage. Browsers can throw on any
// access (blocked site data, private windows, exhausted quota), and the app has
// to keep working in memory when that happens - so every call is guarded.
const createStore = (getStore) => ({
  get(key) {
    try { return getStore().getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { getStore().setItem(key, value); return true; } catch { return false; }
  },
  remove(key) {
    try { getStore().removeItem(key); } catch { /* nothing to remove */ }
  },
  getJSON(key, fallback) {
    const raw = this.get(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    return this.set(key, JSON.stringify(value));
  }
});

export const local = createStore(() => window.localStorage);
export const session = createStore(() => window.sessionStorage);
