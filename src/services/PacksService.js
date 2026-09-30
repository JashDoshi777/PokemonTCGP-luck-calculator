import { PACKS } from '../data';
import { dataService } from './DataService';

// Community-maintained booster box art, keyed by set code. Falls back to a
// text logo, then a plain placeholder, if a set isn't covered yet.
const PACK_ART_CDN = 'https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-cards@main/images/webp/packs';
const LOGO_CDN = 'https://assets.tcgdex.net/en/tcgp';

// A handful of early (pre-Deluxe Pack) sets have multiple boosters and are
// filed by the featured character's name instead of a generic "-booster"
// suffix - these need an explicit filename rather than the standard pattern.
const LEGACY_ART_SLUGS = {
  A1: 'charizard',
  A1a: 'mew',
  A2: 'dialga',
  A2a: 'arceus',
  A3: 'lunala',
  A4: 'ho-oh',
  B1: 'megaaltaria',
};

export function packArtCandidates(code) {
  const legacySlug = LEGACY_ART_SLUGS[code];
  return [
    ...(legacySlug ? [`${PACK_ART_CDN}/${code.toLowerCase()}-${legacySlug}.webp`] : []),
    `${PACK_ART_CDN}/${code.toLowerCase()}-booster.webp`,
    `${LOGO_CDN}/${code}/logo.webp`,
  ];
}

function formatReleaseDate(isoDate) {
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? 'TBA' : d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Sort key for a pack. Curated packs only carry a label like "Oct 2024", which
// `new Date('Oct 2024')` parses in Chrome but NOT in Safari, so read it by hand.
function releaseTime(pack) {
  if (pack.releaseDate) {
    const t = Date.parse(pack.releaseDate);
    if (!Number.isNaN(t)) return t;
  }
  const match = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(String(pack.date || '').trim());
  if (match) {
    const month = MONTHS.indexOf(match[1].toLowerCase());
    if (month !== -1) return Date.UTC(Number(match[2]), month, 1);
  }
  return Number.MAX_SAFE_INTEGER; // undated packs go last
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
// pack mechanic. Returns that booster's own appearance rate (as a 0-1
// probability, matching how GOD_RATE/SHINY_GOD_RATE are expressed) so a
// future set with this mechanic at a different odds isn't silently scored
// against Mega Shine's specific rate - or null if the set has no such booster.
function detectShinyGodPack(setRates) {
  if (!isSlotsObject(setRates)) return null;
  const standardNames = ['Regular Pack', 'Rare Pack', 'Regular Pack +1'];
  for (const [name, booster] of Object.entries(setRates)) {
    if (standardNames.includes(name) || !isSlotsObject(booster?.slots)) continue;
    const slots = Object.values(booster.slots);
    const isShinyGodPack = slots.length > 0 && slots.every(slot => isGuaranteedSlot(slot, ['S', 'SSR']));
    if (isShinyGodPack && typeof booster.appearance_rate === 'number') {
      return booster.appearance_rate / 100;
    }
  }
  return null;
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
        const shinyGodPackRate = detectShinyGodPack(setRates);

        autoPacks.push({
          id: set.code.toLowerCase(),
          code: set.code,
          name: set.name?.en || set.code,
          date: formatReleaseDate(set.releaseDate),
          releaseDate: set.releaseDate,
          hasShiny,
          shinySlot6,
          guaranteedEx,
          hasShinyGodPack: shinyGodPackRate !== null,
          shinyGodPackRate,
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

  const merged = [...PACKS, ...autoPacks].sort((a, b) => releaseTime(a) - releaseTime(b));

  // Only remember the result when both live sources answered. Otherwise new sets
  // are missing (or their shiny/guaranteed-ex flags are wrong), and caching that
  // would leave the partial list stuck until the page is reloaded.
  if (sets && pullRates) cachedPacks = merged;
  return merged;
}
