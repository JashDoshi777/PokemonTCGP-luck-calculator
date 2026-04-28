import { BASE_RATES, DELUXE_RATES, BASE_RATES_SLOT6, SHINY_OVERALL_BLEND, GOD_RATE, SHINY_GOD_RATE, SMEW_RATE, RARITIES } from './data';

export function getShinyRate(key, pack) {
  if ((key === 's1' || key === 's2') && pack && pack.shinySlot6) {
    return BASE_RATES_SLOT6[key] || 0;
  }
  return BASE_RATES[key] || 0;
}

export function getEffectiveRate(rarityKey, pack) {
  if (rarityKey === 'sMew') {
    return SMEW_RATE;
  }
  if (pack && pack.id === 'deluxe') {
    return DELUXE_RATES[rarityKey] || 0;
  }
  
  if (rarityKey === 's1' || rarityKey === 's2') {
    if (pack) return getShinyRate(rarityKey, pack);
    return SHINY_OVERALL_BLEND[rarityKey] || 0;
  }
  return BASE_RATES[rarityKey] || 0;
}

export function poissonCDF(lam, k) {
  if (lam <= 0) return k >= 0 ? 1 : 0;
  let s = 0, t = Math.exp(-lam);
  for (let i = 0; i <= k; i++) {
    s += t;
    t *= lam / (i + 1);
  }
  return Math.min(s, 1);
}

export function zSc(lam, k) {
  return lam > 0 ? (k - lam) / Math.sqrt(lam) : 0;
}

export function normCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sg = z < 0 ? -1 : 1;
  const zz = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * zz);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-zz * zz);
  return 0.5 * (1 + sg * y);
}

export function runLuckCalculation(totalPacks, counts, mode, selectedPack, deluxePacks = 0) {
  const N = parseInt(totalPacks) || 0;
  if (N < 1) return null;

  const showShiny = mode === 'overall' || selectedPack.hasShiny;
  const active = RARITIES.filter(r => {
    if (r.packSpecific && r.packSpecific !== selectedPack?.id) return false;
    return !r.shinyOnly || showShiny;
  });
  
  const isSlot6Context = mode === 'perset' && selectedPack.shinySlot6;

  const godCount = parseInt(counts.godPack) || 0;
  // If Deluxe packs are involved in overall mode, or we are specifically in Deluxe perset, they don't drop God packs.
  const stdNForGod = mode === 'overall' ? Math.max(0, N - (parseInt(deluxePacks) || 0)) : (selectedPack?.id === 'deluxe' ? 0 : N);
  const godExp = stdNForGod * GOD_RATE;
  const godZ = zSc(godExp, godCount);

  let twz = godZ * 100;
  let tw = 100;
  
  let shinyGodCount = 0;
  let shinyGodExp = 0;
  let shinyGodZ = 0;
  let shinyGodPct = 1;
  
  if (selectedPack?.id === 'megashine') {
    shinyGodCount = parseInt(counts.shinyGodPack) || 0;
    shinyGodExp = N * SHINY_GOD_RATE;
    shinyGodZ = zSc(shinyGodExp, shinyGodCount);
    shinyGodPct = normCDF(shinyGodZ);
    twz += shinyGodZ * 200; // heavy weight for extremely rare pack
    tw += 200;
  }

  const results = active.map(r => {
    const got = parseInt(counts[r.id]) || 0;
    const packCtx = mode === 'perset' ? selectedPack : null;
    
    let exp = 0;
    let prob = 0;
    
    if (mode === 'overall') {
      const N_dlx = Math.max(0, parseInt(deluxePacks) || 0);
      const N_std = Math.max(0, N - N_dlx);
      exp = (N_std * getEffectiveRate(r.key, null)) + (N_dlx * (DELUXE_RATES[r.key] || 0));
      prob = N > 0 ? exp / N : 0;
    } else {
      prob = getEffectiveRate(r.key, packCtx);
      exp = N * prob;
    }
    const z = zSc(exp, got);

    let pct;
    if (exp < 5) {
      const cb = got > 0 ? poissonCDF(exp, got - 1) : 0;
      pct = (cb + poissonCDF(exp, got)) / 2;
    } else {
      pct = normCDF(z);
    }

    let w = r.weight;
    if (isSlot6Context && r.key === 's1') w = 300;
    if (isSlot6Context && r.key === 's2') w = 220;

    twz += z * w;
    tw += w;

    return { r, got, exp, pct, prob };
  });

  const oz = twz / tw;
  const op = normCDF(oz);
  const score = Math.max(1, Math.min(10, Math.round((1 + 9 * op) * 10) / 10));

  return {
    score,
    overallPct: op,
    results,
    godCount,
    godExp,
    godPct: normCDF(godZ),
    shinyGodCount,
    shinyGodExp,
    shinyGodPct
  };
}
