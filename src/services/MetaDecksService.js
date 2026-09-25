// Live meta tier-list, sourced from PocketDecks' community-run data pipeline
// (refreshed from real match data roughly daily) instead of a hand-maintained list.
const DECKS_URL = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-tier-list@main/public/data/best-decks.json';
const CARDS_URL = 'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-cards@5/data/v5/cards.core.min.json';
// The card DB's own `image` field points at raw.githubusercontent.com, which is not meant
// for hotlinking at volume and can hang/502 under load. jsdelivr mirrors the same repo
// reliably, so rebuild the URL from the card id instead of trusting the raw field.
const CARD_IMAGE_CDN = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-cards@main/images/webp/cards';

const ENERGY_TYPES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function parseCardRef(ref) {
  const [count, id] = ref.split(':');
  return { count: parseInt(count, 10), id };
}

function bestList(deck) {
  return deck.lists.reduce((best, l) => (l.score > (best?.score ?? -Infinity) ? l : best), null);
}

// A deck's energy is the elemental type of its highest-point (usually the ex/Mega ex
// attacker) Pokémon card, which is the closest live signal to "what archetype is this".
function resolveDeck(deck, cardsById) {
  const list = bestList(deck);
  if (!list) return null;

  const resolvedCards = list.cards.map(parseCardRef).map(({ count, id }) => {
    const c = cardsById.get(id);
    if (!c) return null;
    const [setCode, number] = id.split('-');
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
  });

  if (resolvedCards.some(c => !c)) return null; // skip decks we can't fully resolve

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

export async function getLiveMetaDecks() {
  if (cachedDecks) return cachedDecks;

  const [rawDecks, rawCards] = await Promise.all([fetchJson(DECKS_URL), fetchJson(CARDS_URL)]);
  const cardsById = new Map(rawCards.map(c => [c.id, c]));

  const resolved = rawDecks.map(d => resolveDeck(d, cardsById)).filter(Boolean);

  // Best (highest live meta score) deck per energy type = that type's current S-Tier pick.
  const byType = new Map();
  for (const deck of resolved) {
    const current = byType.get(deck.type);
    if (!current || deck.metaScore > current.metaScore) byType.set(deck.type, deck);
  }

  const decks = ENERGY_TYPES.map(t => byType.get(t)).filter(Boolean);

  cachedDecks = decks;
  return decks;
}
