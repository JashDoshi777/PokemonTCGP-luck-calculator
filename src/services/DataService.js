import { fetchJson } from './http';

const BASE_URL = 'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist';

// The CDN resolves "@latest" and caches it, so the cache-buster only changes every
// six hours: fresh enough to pick up a new set quickly, while letting the browser
// and CDN cache the multi-megabyte files between visits (a per-request timestamp
// would force a full re-download on every page load).
const cacheBucket = () => Math.floor(Date.now() / 21_600_000);

class DataService {
  constructor() {
    this.cache = new Map(); // filename -> Promise of the parsed JSON
  }

  // Concurrent callers share one request. A failed request is forgotten, so the
  // next call tries again, and the caller gets null rather than an exception.
  fetchWithCache(filename) {
    if (!this.cache.has(filename)) {
      const request = fetchJson(`${BASE_URL}/${filename}?v=${cacheBucket()}`, { retries: 1, timeoutMs: 20000 })
        .catch((error) => {
          console.error(`DataService: could not load ${filename}`, error);
          this.cache.delete(filename);
          return null;
        });
      this.cache.set(filename, request);
    }
    return this.cache.get(filename);
  }

  getCards() {
    return this.fetchWithCache('cards.json');
  }

  getSets() {
    return this.fetchWithCache('sets.json');
  }

  getRarities() {
    return this.fetchWithCache('rarities.json');
  }

  getPullRates() {
    return this.fetchWithCache('pullRates.json');
  }

  // Derived getters for convenience
  async getCardsBySet(setCode) {
    const cards = await this.getCards();
    if (!cards) return [];
    return cards.filter(card => card.set === setCode);
  }

  // Pre-fetch everything the app needs to start. Throws if the card list or set
  // list can't be loaded, so the app can show a proper "couldn't load" state
  // instead of pretending the catalog is simply empty.
  async initialize() {
    const [cards, sets] = await Promise.all([this.getCards(), this.getSets(), this.getRarities()]);
    if (!Array.isArray(cards) || !sets) {
      throw new Error('Could not load the card database');
    }
    return true;
  }
}

export const dataService = new DataService();
