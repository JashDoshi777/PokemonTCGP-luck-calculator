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

function isSlotsObject(slots) {
  return !!slots && typeof slots === 'object' && !Array.isArray(slots);
}

function slotsHaveAny(slots, keys) {
  if (!isSlotsObject(slots)) return false;
  return Object.values(slots).some(slot => isSlotsObject(slot) && keys.some(k => k in slot));
}

// A slot that resolves to a single rarity 100% of the time is a guaranteed
// hit - used to detect guaranteed-ex packs (Deluxe Pack ex-style) and
// dedicated shiny-god-pack booster types (Mega Shine-style) without relying
// on a hardcoded set id, so future sets reusing these mechanics still work
// before anyone manually curates them into data.js.
function isGuaranteedSlot(slot, keys) {
  if (!isSlotsObject(slot)) return false;
  const entries = Object.entries(slot);
  return entries.length === 1 && keys.includes(entries[0][0]) && entries[0][1] >= 99.9;
}

function detectShinyFlags(setRates) {
  if (!isSlotsObject(setRates)) return { hasShiny: false, shinySlot6: false };

  const shinyKeys = ['S', 'SSR'];
  const boosters = Object.values(setRates).filter(b => isSlotsObject(b?.slots));
  const hasShiny = boosters.some(booster => slotsHaveAny(booster.slots, shinyKeys));

  const bonusBooster = setRates['Regular Pack +1'];
  let shinySlot6 = false;
  if (isSlotsObject(bonusBooster?.slots)) {
    const slotNumbers = Object.keys(bonusBooster.slots).map(Number).filter(Number.isFinite);
    if (slotNumbers.length > 0) {
      const lastSlotKey = String(Math.max(...slotNumbers));
      const lastSlot = bonusBooster.slots[lastSlotKey];
      shinySlot6 = isSlotsObject(lastSlot) && Object.keys(lastSlot).every(k => shinyKeys.includes(k));
    }
  }

  return { hasShiny, shinySlot6 };
}

// The "main" booster is whichever one appears most often - guaranteed-ex
// packs put their guaranteed 4-diamond-ex slot in this booster.
function detectGuaranteedEx(setRates) {
  if (!isSlotsObject(setRates)) return false;
  const boosters = Object.values(setRates).filter(b => isSlotsObject(b?.slots));
  if (boosters.length === 0) return false;
  const mainBooster = boosters.reduce((best, b) =>
    (b.appearance_rate || 0) > (best.appearance_rate || 0) ? b : best, boosters[0]);
  return Object.values(mainBooster.slots).some(slot => isGuaranteedSlot(slot, ['RR']));
}

// A dedicated low-odds booster type (distinct from the standard Regular/Rare
// Pack variants) whose every slot guarantees a shiny rarity is a shiny-god-
// pack mechanic.
function detectShinyGodPack(setRates) {
  if (!isSlotsObject(setRates)) return false;
  const standardNames = ['Regular Pack', 'Rare Pack', 'Regular Pack +1'];
  return Object.entries(setRates).some(([name, booster]) => {
    if (standardNames.includes(name) || !isSlotsObject(booster?.slots)) return false;
    const slots = Object.values(booster.slots);
    return slots.length > 0 && slots.every(slot => isGuaranteedSlot(slot, ['S', 'SSR']));
  });
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
  if (sets && typeof sets === 'object') {
    const allSets = Object.values(sets).flat();
    for (const set of allSets) {
      if (!set?.code || knownCodes.has(set.code)) continue;
      if (set.code.startsWith('PROMO')) continue;

      try {
        const setRates = pullRates?.[set.code];
        const { hasShiny, shinySlot6 } = detectShinyFlags(setRates);
        const guaranteedEx = detectGuaranteedEx(setRates);
        const hasShinyGodPack = detectShinyGodPack(setRates);

        autoPacks.push({
          id: set.code.toLowerCase(),
          code: set.code,
          name: set.name?.en || set.code,
          date: formatReleaseDate(set.releaseDate),
          releaseDate: set.releaseDate,
          hasShiny,
          shinySlot6,
          guaranteedEx,
          hasShinyGodPack,
          packs: set.packs?.length || 1,
          img: packArtCandidates(set.code)[0],
          imgCandidates: packArtCandidates(set.code),
          auto: true,
        });
      } catch (e) {
        console.error(`Skipping auto-pack for ${set.code} due to malformed pull-rate data:`, e);
      }
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
