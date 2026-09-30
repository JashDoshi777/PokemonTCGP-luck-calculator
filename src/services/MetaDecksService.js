import { fetchJson } from './http';
import { getCoreCards } from './cardsCore';

// Live meta tier-list, sourced from PocketDecks' community-run data pipeline
// (refreshed from real match data roughly daily) instead of a hand-maintained list.
// resolveDeck() below is defensive against a handful of individually-missing cards.
const DECKS_URL = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-tier-list@main/public/data/best-decks.json';
// The card DB's own `image` field points at raw.githubusercontent.com, which is not meant
// for hotlinking at volume and can hang/502 under load. jsdelivr mirrors the same repo
// reliably, so rebuild the URL from the card id instead of trusting the raw field.
const CARD_IMAGE_CDN = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-cards@main/images/webp/cards';

const ENERGY_TYPES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'];

// "2:a1-001" -> { count: 2, id: 'a1-001' }; null for anything malformed.
function parseCardRef(ref) {
  if (typeof ref !== 'string') return null;
  const [count, id] = ref.split(':');
  const n = parseInt(count, 10);
  return Number.isFinite(n) && n > 0 && id ? { count: n, id } : null;
}

// A card id is "<set>-<number>". Some set codes contain hyphens themselves, so split on the LAST one.
function splitCardId(id) {
  const dash = id.lastIndexOf('-');
  return dash > 0 ? { setCode: id.slice(0, dash), number: id.slice(dash + 1) } : null;
}

function bestList(deck) {
  if (!Array.isArray(deck?.lists)) return null;
  return deck.lists.reduce((best, l) => (l && l.score > (best?.score ?? -Infinity) ? l : best), null);
}

// A deck's energy is the elemental type of its highest-point (usually the ex/Mega ex
// attacker) Pokémon card, which is the closest live signal to "what archetype is this".
function resolveDeck(deck, cardsById) {
  const list = bestList(deck);
  if (!list) return null;

  if (!Array.isArray(list.cards)) return null;
  const cardRefs = list.cards.map(parseCardRef).filter(Boolean);
  const resolvedCards = cardRefs.map(({ count, id }) => {
    const c = cardsById.get(id);
    const parts = c ? splitCardId(id) : null;
    if (!c || !parts) return null;
    const { setCode, number } = parts;
    return {
      name: c.name,
      count,
      set: setCode.toUpperCase(),
      number,
      artUrl: `${CARD_IMAGE_CDN}/${setCode}/${number}.webp`,
      subtype: c.subtype,
      points: c.points || 0,
      isPokemon: c.type === 'Pokémon',
    };
  }).filter(Boolean);

  // Tolerate a card DB that's briefly behind the (more frequently updated) tier
  // list - drop the handful of unresolved cards rather than discarding the whole
  // deck, but bail if too much of it failed to resolve to show something sane.
  if (resolvedCards.length === 0 || resolvedCards.length < cardRefs.length * 0.7) return null;

  const pokemonCards = resolvedCards.filter(c => c.isPokemon);
  const mainAttacker = pokemonCards
    .filter(c => c.subtype && c.subtype !== 'Colorless')
    .sort((a, b) => b.points - a.points)[0];
  const energy = mainAttacker?.subtype || pokemonCards[0]?.subtype || 'Colorless';

  const byPoints = [...pokemonCards].sort((a, b) => b.points - a.points);
  const headliners = byPoints.filter(c => c.points >= 2).map(c => c.name);
  const uniqueHeadliners = [...new Set(headliners)].slice(0, 2);
  const name = uniqueHeadliners.length > 0 ? uniqueHeadliners.join(' / ') : pokemonCards[0]?.name || deck.name;

  // The deck's namesake card (its single strongest Pokémon) leads the card list,
  // so it's what the grid thumbnail shows - not just whatever came first in the raw data.
  const headlinerCard = byPoints[0];
  const orderedCards = headlinerCard
    ? [headlinerCard, ...resolvedCards.filter(c => c !== headlinerCard)]
    : resolvedCards;

  return {
    id: deck.name,
    name,
    tier: 'S-Tier',
    type: energy,
    description: `Top-performing ${energy}-type archetype in the live meta — ${(deck.popularity * 100).toFixed(1)}% pick rate, ${(deck.expectedWinRate * 100).toFixed(1)}% expected win rate.`,
    metaScore: deck.metaScore,
    cards: orderedCards.map(({ name: n, count, set, number, artUrl }) => ({ name: n, count, set, number, artUrl })),
  };
}

let cachedDecks = null;
let inFlight = null;

// Loads (once) and returns the live S-tier decks. Failures and empty results are
// never cached, so a retry really retries.
export function getLiveMetaDecks() {
  if (cachedDecks) return Promise.resolve(cachedDecks);
  if (!inFlight) {
    inFlight = loadLiveMetaDecks()
      .then(decks => {
        if (decks.length > 0) cachedDecks = decks;
        return decks;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

async function loadLiveMetaDecks() {
  const [rawDecks, rawCards] = await Promise.all([fetchJson(DECKS_URL, { retries: 1 }), getCoreCards()]);
  if (!Array.isArray(rawDecks) || !Array.isArray(rawCards)) throw new Error('Unexpected meta data format');
  // Keep the first entry deterministically if the upstream DB ever has a
  // duplicate id, rather than silently letting a later one overwrite it.
  const cardsById = new Map();
  for (const c of rawCards) {
    if (!cardsById.has(c.id)) cardsById.set(c.id, c);
  }

  // One malformed entry must not take the whole list down with it.
  const resolved = rawDecks.map(d => {
    try { return resolveDeck(d, cardsById); } catch (e) { console.warn('Skipping a meta deck that could not be read', e); return null; }
  }).filter(Boolean);

  // Best (highest live meta score) deck per energy type = that type's current S-Tier pick.
  const byType = new Map();
  for (const deck of resolved) {
    const current = byType.get(deck.type);
    if (!current || deck.metaScore > current.metaScore) byType.set(deck.type, deck);
  }

  return ENERGY_TYPES.map(t => byType.get(t)).filter(Boolean);
}
