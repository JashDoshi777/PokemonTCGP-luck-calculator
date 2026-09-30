import { fetchJson } from './http';

// The actively maintained community card database. Pinned to a major version
// (jsDelivr resolves "@5" to the newest 5.x.x release, so new sets are still
// picked up) rather than "@latest", so a future major schema change upstream
// can't silently break the path.
const CARDS_URL = 'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-cards@5/data/v5/cards.core.min.json';

let pending = null;

// Several features read this same large file (meta decks, energy filters), so it
// is downloaded once and shared. A failed download is not remembered.
export function getCoreCards() {
  if (!pending) {
    pending = fetchJson(CARDS_URL, { retries: 1 }).catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
