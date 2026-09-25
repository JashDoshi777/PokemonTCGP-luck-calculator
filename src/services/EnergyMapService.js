import staticEnergyMapping from '../data/energy_mapping.json';

// The bundled energy_mapping.json is a hand-generated, point-in-time snapshot
// that goes stale every time a new set ships. This fetches the live, actively
// maintained card database (same source used for Meta Decks) and derives a
// complete, always-current name -> elemental type map instead.
const CARDS_URL = 'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-cards@5/data/v5/cards.core.min.json';

let cachedMap = null;

export async function getEnergyMap() {
  if (cachedMap) return cachedMap;

  try {
    const res = await fetch(CARDS_URL);
    if (!res.ok) throw new Error('Failed to fetch card energy data');
    const cards = await res.json();

    const liveMap = {};
    for (const c of cards) {
      if (c.type === 'Pokémon' && c.subtype) liveMap[c.name] = c.subtype;
    }

    // Live data wins where it disagrees with the static snapshot; the static
    // map only fills gaps if the live fetch is ever missing something.
    cachedMap = { ...staticEnergyMapping, ...liveMap };
  } catch {
    cachedMap = staticEnergyMapping;
  }

  return cachedMap;
}

export { staticEnergyMapping };
