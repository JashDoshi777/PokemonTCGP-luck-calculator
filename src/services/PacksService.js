import { PACKS } from '../data';
import { dataService } from './DataService';

// Community-maintained booster box art, keyed by set code. Falls back to a
// text logo, then a plain placeholder, if a set isn't covered yet.
const PACK_ART_CDN = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-cards@main/images/webp/packs';
const LOGO_CDN = 'https://assets.tcgdex.net/en/tcgp';

export function packArtCandidates(code) {
  return [
    `${PACK_ART_CDN}/${code.toLowerCase()}-booster.webp`,
    `${LOGO_CDN}/${code}/logo.webp`,
  ];
}

function formatReleaseDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function slotsHaveAny(slots, keys) {
  if (!slots) return false;
  return Object.values(slots).some(slot => keys.some(k => k in slot));
}

function detectShinyFlags(setRates) {
  if (!setRates) return { hasShiny: false, shinySlot6: false };

  const shinyKeys = ['S', 'SSR'];
  const hasShiny = Object.values(setRates).some(booster => slotsHaveAny(booster.slots, shinyKeys));

  const bonusBooster = setRates['Regular Pack +1'];
  let shinySlot6 = false;
  if (bonusBooster?.slots) {
    const slotNumbers = Object.keys(bonusBooster.slots).map(Number);
    const lastSlotKey = String(Math.max(...slotNumbers));
    const lastSlot = bonusBooster.slots[lastSlotKey];
    shinySlot6 = lastSlot && Object.keys(lastSlot).every(k => shinyKeys.includes(k));
  }

  return { hasShiny, shinySlot6 };
}

let cachedPacks = null;

// Builds the full Dex pack list: the hand-curated PACKS entries (which carry
// historical pool data used elsewhere) plus any set the CDN knows about that
// isn't in that list yet, auto-populated from live set + pull-rate data.
export async function getAllPacks() {
  if (cachedPacks) return cachedPacks;

  const knownCodes = new Set(PACKS.map(p => p.code));

  const [sets, pullRates] = await Promise.all([
    dataService.getSets(),
    dataService.getPullRates(),
  ]);

  const autoPacks = [];
  if (sets) {
    const allSets = [...(sets.A || []), ...(sets.B || [])];
    for (const set of allSets) {
      if (!set.code || knownCodes.has(set.code)) continue;
      if (set.code.startsWith('PROMO')) continue;

      const { hasShiny, shinySlot6 } = detectShinyFlags(pullRates?.[set.code]);

      autoPacks.push({
        id: set.code.toLowerCase(),
        code: set.code,
        name: set.name?.en || set.code,
        date: formatReleaseDate(set.releaseDate),
        releaseDate: set.releaseDate,
        hasShiny,
        shinySlot6,
        packs: set.packs?.length || 1,
        img: packArtCandidates(set.code)[0],
        imgCandidates: packArtCandidates(set.code),
        auto: true,
      });
    }
  }

  const merged = [...PACKS, ...autoPacks].sort((a, b) => {
    const da = a.releaseDate ? new Date(a.releaseDate) : new Date(a.date);
    const db = b.releaseDate ? new Date(b.releaseDate) : new Date(b.date);
    return da - db;
  });

  cachedPacks = merged;
  return merged;
}
