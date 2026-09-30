import staticEnergyMapping from '../data/energy_mapping.json';
import { getCoreCards } from './cardsCore';

// The bundled energy_mapping.json is a hand-generated, point-in-time snapshot
// that goes stale every time a new set ships. This reads the live, actively
// maintained card database (shared with Meta Decks, downloaded once) and derives
// a complete, always-current name -> elemental type map instead.
let cachedMap = null;

export async function getEnergyMap() {
  if (cachedMap) return cachedMap;

  try {
    const cards = await getCoreCards();

    const liveMap = {};
    for (const c of cards) {
      if (c.type === 'Pokémon' && c.subtype) liveMap[c.name] = c.subtype;
    }

    // Live data wins where it disagrees with the static snapshot; the static
    // map only fills gaps if the live fetch is ever missing something.
    cachedMap = { ...staticEnergyMapping, ...liveMap };
    return cachedMap;
  } catch (error) {
    // Offline or the CDN is down: the bundled snapshot is good enough. It is not
    // cached as "the answer", so a later call tries the live data again.
    console.warn('Using the bundled energy map; live data unavailable', error);
    return staticEnergyMapping;
  }
}

export { staticEnergyMapping };
