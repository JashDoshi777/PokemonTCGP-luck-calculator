import { BASE_RATES, DELUXE_RATES, BASE_RATES_SLOT6, SHINY_OVERALL_BLEND, GOD_RATE, SHINY_GOD_RATE, RARITIES } from './data';

export function getShinyRate(key, pack) {
  if ((key === 's1' || key === 's2') && pack && pack.shinySlot6) {
    return BASE_RATES_SLOT6[key] || 0;
  }
  return BASE_RATES[key] || 0;
}

export function getEffectiveRate(rarityKey, pack) {
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

export function runLuckCalculation(standardPacksInput, counts, mode, selectedPack, deluxePacksInput = 0) {
  const N_input = parseInt(standardPacksInput) || 0;
  const N_dlx = mode === 'overall' ? Math.max(0, parseInt(deluxePacksInput) || 0) : 0;
  
  const N_std = N_input;
  const N_total = N_std + N_dlx;

  if (N_total < 1) return null;

  const showShiny = mode === 'overall' || selectedPack.hasShiny;
  const active = RARITIES.filter(r => {
    if (r.packSpecific && r.packSpecific !== selectedPack?.id) return false;
    return !r.shinyOnly || showShiny;
  });
  
  const isSlot6Context = mode === 'perset' && selectedPack.shinySlot6;

  const godCount = parseInt(counts.godPack) || 0;
  // Deluxe packs don't drop God packs.
  const stdNForGod = mode === 'overall' ? N_std : (selectedPack?.id === 'deluxe' ? 0 : N_std);
  const godExp = stdNForGod * GOD_RATE;
  const godZ = zSc(godExp, godCount);

  let sum_wz = 0;
  let sum_ww = 0;
  
  if (stdNForGod > 0) {
    const w = Math.max(1, Math.log(1 / GOD_RATE));
    sum_wz += w * godZ;
    sum_ww += w * w;
  }
  
  let shinyGodCount = 0;
  let shinyGodExp = 0;
  let shinyGodZ = 0;
  let shinyGodPct = 1;
  
  if (selectedPack?.id === 'megashine') {
    shinyGodCount = parseInt(counts.shinyGodPack) || 0;
    shinyGodExp = N_std * SHINY_GOD_RATE;
    shinyGodZ = zSc(shinyGodExp, shinyGodCount);
    shinyGodPct = normCDF(shinyGodZ);
    
    if (N_std > 0) {
      const w = Math.max(1, Math.log(1 / SHINY_GOD_RATE));
      sum_wz += w * shinyGodZ;
      sum_ww += w * w;
    }
  }

  const results = active.map(r => {
    const got = parseInt(counts[r.id]) || 0;
    const packCtx = mode === 'perset' ? selectedPack : null;
    
    let exp = 0;
    let prob = 0;
    
    if (mode === 'overall') {
      exp = (N_std * getEffectiveRate(r.key, null)) + (N_dlx * (DELUXE_RATES[r.key] || 0));
      prob = N_total > 0 ? exp / N_total : 0;
    } else {
      prob = getEffectiveRate(r.key, packCtx);
      exp = N_std * prob;
    }
    const z = zSc(exp, got);

    let pct;
    if (exp < 5) {
      const cb = got > 0 ? poissonCDF(exp, got - 1) : 0;
      pct = (cb + poissonCDF(exp, got)) / 2;
    } else {
      pct = normCDF(z);
    }

    if (exp > 0 && prob > 0) {
      const w = Math.max(1, Math.log(1 / prob));
      sum_wz += w * z;
      sum_ww += w * w;
    }

    return { r, got, exp, pct, prob };
  });

  let Z_combined = sum_ww > 0 ? sum_wz / Math.sqrt(sum_ww) : 0;
  const op = normCDF(Z_combined);
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
