const BASE_URL = 'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist';

class DataService {
  constructor() {
    this.cache = {};
  }

  async fetchWithCache(filename) {
    if (this.cache[filename]) {
      return this.cache[filename];
    }
    try {
      // Add a cache buster query parameter so the browser always fetches the latest version
      // since the CDN might cache 'latest' aggressively.
      const timestamp = new Date().getTime();
      const response = await fetch(`${BASE_URL}/${filename}?v=${timestamp}`);
      if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
      const data = await response.json();
      this.cache[filename] = data;
      return data;
    } catch (error) {
      console.error('DataService Error:', error);
      return null;
    }
  }

  async getCards() {
    return this.fetchWithCache('cards.json');
  }

  async getSets() {
    return this.fetchWithCache('sets.json');
  }

  async getRarities() {
    return this.fetchWithCache('rarities.json');
  }

  // Derived getters for convenience
  async getCardsBySet(setCode) {
    const cards = await this.getCards();
    if (!cards) return [];
    return cards.filter(card => card.set === setCode);
  }

  // Pre-fetch all necessary data
  async initialize() {
    await Promise.all([
      this.getCards(),
      this.getSets(),
      this.getRarities()
    ]);
    return true;
  }
}

export const dataService = new DataService();
