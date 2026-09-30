import { BASE_RATES, DELUXE_RATES, BASE_RATES_SLOT6, SHINY_OVERALL_BLEND, GOD_RATE, SHINY_GOD_RATE, RARITIES } from './data';

export function getShinyRate(key, pack) {
  if ((key === 's1' || key === 's2') && pack && pack.shinySlot6) {
    return BASE_RATES_SLOT6[key] || 0;
  }
  return BASE_RATES[key] || 0;
}

export function getEffectiveRate(rarityKey, pack) {
  if (pack && pack.guaranteedEx) {
    return DELUXE_RATES[rarityKey] || 0;
  }

  if (rarityKey === 's1' || rarityKey === 's2') {
    if (pack) return getShinyRate(rarityKey, pack);
    return SHINY_OVERALL_BLEND[rarityKey] || 0;
  }
  return BASE_RATES[rarityKey] || 0;
}

// P(X <= k) for X ~ Poisson(lam). The terms shrink geometrically once i passes
// lam, so the loop stops as soon as they stop mattering - a huge k can't stall it.
export function poissonCDF(lam, k) {
  if (lam <= 0) return k >= 0 ? 1 : 0;
  let sum = 0;
  let term = Math.exp(-lam);
  for (let i = 0; i <= k; i++) {
    sum += term;
    term *= lam / (i + 1);
    if (term === 0 || (i > lam && term < sum * 1e-16)) break;
  }
  return Math.min(sum, 1);
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

// Inverse of the normal CDF (Acklam's rational approximation, relative error ~1e-9).
export function normInv(p) {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const low = 0.02425;
  if (q < low) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - low) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  const r = (q - 0.5) * (q - 0.5);
  const s = q - 0.5;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * s / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Percentile of `got` successes given an expected count. Rare events (exp < 5, e.g.
// God Packs) use the mid-point Poisson CDF instead of the normal approximation.
function luckPercentile(exp, got) {
  if (exp < 5) {
    const below = got > 0 ? poissonCDF(exp, got - 1) : 0;
    return (below + poissonCDF(exp, got)) / 2;
  }
  return normCDF(zSc(exp, got));
}

const toCount = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function runLuckCalculation(standardPacksInput, counts, mode, selectedPack, deluxePacksInput = 0) {
  const N_std = toCount(standardPacksInput);
  const N_dlx = mode === 'overall' ? toCount(deluxePacksInput) : 0;
  const N_total = N_std + N_dlx;

  if (N_total < 1) return null;

  const showShiny = mode === 'overall' || selectedPack.hasShiny;
  const active = RARITIES.filter(r => {
    if (r.packSpecific && r.packSpecific !== selectedPack?.id) return false;
    return !r.shinyOnly || showShiny;
  });

  // The combined score is a weighted sum of per-rarity z-scores. Each z is derived
  // from the same percentile shown in the UI, so a rare hit can't be scored one
  // way and displayed another. Rarer outcomes carry more weight.
  let sum_wz = 0;
  let sum_ww = 0;
  const addToScore = (percentile, prob) => {
    const w = Math.max(1, Math.log(1 / prob));
    sum_wz += w * normInv(percentile);
    sum_ww += w * w;
  };

  const godCount = toCount(counts.godPack);
  // Guaranteed-ex packs (e.g. Deluxe Pack ex) don't drop God packs.
  const stdNForGod = mode === 'overall' ? N_std : (selectedPack?.guaranteedEx ? 0 : N_std);
  const godExp = stdNForGod * GOD_RATE;
  const godPct = luckPercentile(godExp, godCount);
  if (stdNForGod > 0) addToScore(godPct, GOD_RATE);

  let shinyGodCount = 0;
  let shinyGodExp = 0;
  let shinyGodPct = 1;
  let shinyGodProb = 0;

  if (selectedPack?.hasShinyGodPack) {
    // Auto-detected sets carry their own measured rate; the hand-curated
    // Mega Shine entry has none, so it falls back to its known constant.
    shinyGodProb = selectedPack.shinyGodPackRate || SHINY_GOD_RATE;
    shinyGodCount = toCount(counts.shinyGodPack);
    shinyGodExp = N_std * shinyGodProb;
    shinyGodPct = luckPercentile(shinyGodExp, shinyGodCount);
    if (N_std > 0) addToScore(shinyGodPct, shinyGodProb);
  }

  const results = active.map(r => {
    const got = toCount(counts[r.id]);
    const packCtx = mode === 'perset' ? selectedPack : null;

    let exp = 0;
    let prob = 0;

    if (mode === 'overall') {
      exp = (N_std * getEffectiveRate(r.key, null)) + (N_dlx * (DELUXE_RATES[r.key] || 0));
      prob = exp / N_total;
    } else {
      prob = getEffectiveRate(r.key, packCtx);
      exp = N_std * prob;
    }

    const pct = luckPercentile(exp, got);
    if (exp > 0 && prob > 0) addToScore(pct, prob);

    return { r, got, exp, pct, prob };
  });

  const Z_combined = sum_ww > 0 ? sum_wz / Math.sqrt(sum_ww) : 0;
  const op = normCDF(Z_combined);
  const score = Math.max(1, Math.min(10, Math.round((1 + 9 * op) * 10) / 10));

  return {
    score,
    overallPct: op,
    results,
    godCount,
    godExp,
    godApplicable: stdNForGod > 0,
    godProb: GOD_RATE,
    godPct,
    shinyGodCount,
    shinyGodExp,
    shinyGodPct,
    shinyGodApplicable: !!selectedPack?.hasShinyGodPack && N_std > 0,
    shinyGodProb
  };
}
