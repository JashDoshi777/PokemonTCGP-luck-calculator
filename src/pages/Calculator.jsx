import React, { useState, useRef, useEffect } from 'react';
import { RARITIES, ICONS } from '../data';
import { runLuckCalculation } from '../math';
import { useAppContext } from '../context/AppContext';
import { session } from '../utils/storage';

// Upper bounds keep every downstream calculation (and the statistics loops) cheap and sane.
const MAX_PACKS = 1_000_000;
const MAX_COUNT = 1_000_000;

const parseCount = (raw, max) => {
  const digits = String(raw).replace(/\D/g, '').slice(0, 7);
  return Math.min(max, digits ? parseInt(digits, 10) : 0);
};

const loadCount = (key, max) => {
  const value = parseInt(session.get(key), 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
};

const loadCounts = (key) => {
  const raw = session.getJSON(key, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [id, value] of Object.entries(raw)) {
    if (Number.isFinite(value)) clean[id] = Math.min(MAX_COUNT, Math.max(0, Math.trunc(value)));
  }
  return clean;
};

// Unified rows for the result lists: God Pack / Shiny God Pack first (when they apply), then the card rarities.
function buildDisplayRows(results) {
  const rows = [];
  if (results.godApplicable) {
    rows.push({ id: 'godPack', icon: ICONS.god, got: results.godCount, pct: results.godPct, prob: results.godProb });
  }
  if (results.shinyGodApplicable) {
    rows.push({ id: 'shinyGodPack', icon: `<span style="display:inline-flex;filter:hue-rotate(180deg)">${ICONS.god}</span>`, got: results.shinyGodCount, pct: results.shinyGodPct, prob: results.shinyGodProb });
  }
  return rows.concat(results.results.map(({ r, got, pct, prob }) => ({ id: r.id, icon: r.icon, got, pct, prob })));
}

function Stepper({ value, onChange, step = 1, max, label, style, buttonStyle, inputStyle }) {
  return (
    <div className="stepper-ultra" style={style}>
      <button type="button" className="stepper-btn" style={buttonStyle} aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(0, value - step))}>-</button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="stepper-input"
        style={inputStyle}
        aria-label={label}
        value={value}
        onChange={e => onChange(parseCount(e.target.value, max))}
      />
      <button type="button" className="stepper-btn" style={buttonStyle} aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

// One rarity in the "Trainer's Log": icon + name, and a stepper for how many were pulled.
function RarityRow({ isModal, icon, iconFilter, name, value, onChange }) {
  const cardStyle = !isModal
    ? { padding: '24px 10px', display: 'flex', flexDirection: 'column', height: '100%' }
    : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', gap: '16px', width: '100%' };
  const stepperStyle = !isModal
    ? { padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between', marginTop: 'auto' }
    : { width: '130px', padding: '4px 6px' };
  const buttonSize = isModal ? '28px' : '26px';

  return (
    <div className={isModal ? 'ios-card ios-rarity-row' : 'glass-card'} style={cardStyle}>
      <div style={isModal ? { display: 'flex', alignItems: 'center', gap: '16px' } : { display: 'contents' }}>
        <div
          dangerouslySetInnerHTML={{ __html: icon }}
          style={{ height: isModal ? '24px' : '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isModal ? 'scale(1.2)' : 'scale(1.5)', ...(iconFilter ? { filter: iconFilter } : {}) }}
        />
        <div style={{ fontWeight: 700, margin: isModal ? '0' : '20px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: isModal ? 'left' : 'center', flexGrow: isModal ? 0 : 1, display: 'flex', alignItems: 'center', justifyContent: isModal ? 'flex-start' : 'center' }}>{name}</div>
      </div>
      <Stepper
        value={value}
        onChange={onChange}
        max={MAX_COUNT}
        label={`${name} pulled`}
        style={stepperStyle}
        buttonStyle={{ width: buttonSize, height: buttonSize, fontSize: '1rem' }}
        inputStyle={{ width: '100%', minWidth: 0, fontSize: isModal ? '1.2rem' : '1.1rem', padding: 0 }}
      />
    </div>
  );
}

const verdictFor = (score) => {
  if (score >= 8.5) return { title: 'Legendary', quote: 'Arceus himself smiles upon you.' };
  if (score >= 7) return { title: 'Lucky', quote: 'Clearly above what probability predicts.' };
  if (score >= 5) return { title: 'Average', quote: 'Right in line with expected pull rates.' };
  if (score >= 3.5) return { title: 'Unlucky', quote: 'Below average — variance is a cruel thing.' };
  return { title: 'Cursed', quote: 'The gacha gods have abandoned you.' };
};

const toneFor = (percentage) => {
  if (percentage < 30) return { label: 'Unlucky', bar: '#ff3b30', bg: '#ffebe9', fg: '#ff3b30' };
  if (percentage < 70) return { label: 'Average', bar: '#007aff', bg: '#e5f0ff', fg: '#007aff' };
  if (percentage >= 95) return { label: 'Legendary', bar: '#af52de', bg: '#f4e5fa', fg: '#af52de' };
  return { label: 'Incredible', bar: '#34c759', bg: '#e5f9e7', fg: '#34c759' };
};

function Calculator({ mode, selectedPack, isModal }) {
  const { saveLuckStat } = useAppContext();
  const storageKey = `pokemontcgp-calc-${mode}-${selectedPack?.id || 'overall'}`;

  const [packsOpened, setPacksOpened] = useState(() => loadCount(`${storageKey}-packs`, MAX_PACKS));
  const [deluxePacksOpened, setDeluxePacksOpened] = useState(() => loadCount(`${storageKey}-deluxePacks`, MAX_PACKS));
  const [counts, setCounts] = useState(() => loadCounts(`${storageKey}-counts`));
  const [results, setResults] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    session.set(`${storageKey}-packs`, String(packsOpened));
    session.set(`${storageKey}-deluxePacks`, String(deluxePacksOpened));
    session.setJSON(`${storageKey}-counts`, counts);
  }, [packsOpened, deluxePacksOpened, counts, storageKey]);

  const resultsRef = useRef(null);

  const setCount = (id, value) => setCounts(prev => ({ ...prev, [id]: Math.min(MAX_COUNT, Math.max(0, value)) }));

  const compute = () => (
    packsOpened > 0 || deluxePacksOpened > 0
      ? runLuckCalculation(packsOpened, counts, mode, selectedPack, deluxePacksOpened)
      : null
  );

  const handleEvaluate = () => {
    const result = compute();
    if (!result) {
      setNotice('Enter how many packs you opened first.');
      return;
    }
    setNotice(null);
    setResults(result);

    if (mode === 'overall') {
      // Remember the latest overall luck result on the account for the profile page.
      saveLuckStat({ score: result.score, overallPct: result.overallPct, packs: packsOpened + deluxePacksOpened });
    }

    // Bring the evaluation into view.
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Once results are showing, keep them in step with the inputs (and drop them if the inputs no longer support a result).
  useEffect(() => {
    setResults(prev => (prev ? compute() : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packsOpened, deluxePacksOpened, counts, mode, selectedPack]);

  const displayRows = results ? buildDisplayRows(results) : [];
  const blended = mode === 'overall' && deluxePacksOpened > 0;
  const verdict = results ? verdictFor(results.score) : null;

  const rowStyle = !isModal
    ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }
    : { width: '100%' };
  const visibleRarities = RARITIES.filter(r => {
    if (r.packSpecific && r.packSpecific !== selectedPack?.id) return false;
    return !r.shinyOnly || mode === 'overall' || selectedPack.hasShiny;
  });

  return (
    <div className={`layout-grid animate-enter ${isModal ? 'ios-mode' : ''}`}>
      <div className={isModal ? 'ios-section' : 'glass-panel'}>
        <>
            <h2 className={isModal ? 'ios-section-header' : 'text-gradient'} style={!isModal ? { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' } : {}}>Trainer's Log</h2>

            <div className="calc-form" style={{ display: 'flex', flexDirection: 'column', gap: isModal ? '16px' : '32px' }}>
              <div className={isModal ? 'ios-card' : 'calc-row'} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: isModal ? '1.1rem' : '1.4rem' }}>{mode === 'overall' ? 'Standard Packs' : 'Total Packs'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Enter the exact number opened</div>
                </div>
                <Stepper value={packsOpened} onChange={setPacksOpened} step={10} max={MAX_PACKS} label={mode === 'overall' ? 'standard packs opened' : 'packs opened'} />
              </div>

              {mode === 'overall' && (
                <div className={isModal ? 'ios-card' : 'calc-row'} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: isModal ? '1.1rem' : '1.4rem' }}>Deluxe ex and Mega Deluxe ex Packs</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>These guarantee an ex, handled separately!</div>
                  </div>
                  <Stepper value={deluxePacksOpened} onChange={setDeluxePacksOpened} step={10} max={MAX_PACKS} label="deluxe packs opened" />
                </div>
              )}

              <div className={isModal ? '' : 'rarity-grid'} style={isModal ? { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' } : { marginTop: '20px' }}>
                {!(mode === 'perset' && selectedPack?.guaranteedEx) && (
                  <RarityRow isModal={isModal} icon={ICONS.god} name="God Pack" value={counts.godPack || 0} onChange={v => setCount('godPack', v)} />
                )}

                {mode === 'perset' && selectedPack?.hasShinyGodPack && (
                  <RarityRow isModal={isModal} icon={ICONS.god} iconFilter="hue-rotate(180deg)" name="Shiny God Pack" value={counts.shinyGodPack || 0} onChange={v => setCount('shinyGodPack', v)} />
                )}

                {visibleRarities.map(r => (
                  <RarityRow key={r.id} isModal={isModal} icon={r.icon} name={r.name} value={counts[r.id] || 0} onChange={v => setCount(r.id, v)} />
                ))}
              </div>

              <button className="btn-super" onClick={handleEvaluate} style={{ width: '100%', marginTop: '20px' }}>
                Evaluate Pulls!
              </button>
              <div className="calc-notice" role="status" aria-live="polite">{notice}</div>
            </div>
        </>
      </div>

      <div ref={resultsRef} className={isModal ? 'ios-section' : 'glass-panel sticky-panel'}>
        <h2 className={isModal ? 'ios-section-header' : 'text-gradient'} style={!isModal ? { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' } : {}}>Professor's Evaluation</h2>
        {results ? (
          <div className="animate-enter">
            <div className="score-card" style={isModal ? { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px', marginBottom: '16px' } : {}}>
              <div className={`score-value ${results.score >= 7 ? 'text-gradient-red' : ''}`} style={results.score < 7 ? { background: 'linear-gradient(135deg, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}}>
                {results.score.toFixed(1)} <span style={{ fontSize: '0.4em', color: '#888' }}>/ 10</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.6rem', marginTop: '16px', letterSpacing: '-0.02em', color: '#fff' }}>{verdict.title}</div>
              <div style={{ fontSize: '1.1rem', marginTop: '12px', color: '#86868b', fontWeight: 600, fontStyle: 'italic', padding: '0 20px', lineHeight: 1.4 }}>
                "{verdict.quote}"
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px', paddingLeft: isModal ? '20px' : '8px' }}>Luck Distribution</h3>
              <div className={isModal ? 'ios-card' : 'data-card'} style={!isModal ? { background: 'var(--card-bg, rgba(255,255,255,0.7))', borderRadius: 'var(--radius-lg)', padding: '24px' } : { display: 'flex', flexDirection: 'column', padding: '20px', gap: '20px', alignItems: 'stretch', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {displayRows.map(({ id, icon, got, pct }) => {
                    const percentage = pct * 100;
                    const tone = toneFor(percentage);
                    return (
                      <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div dangerouslySetInnerHTML={{ __html: icon }} style={{ height: '24px', display: 'flex', alignItems: 'center' }} />
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>&times;{got}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Top {(100 - percentage).toFixed(2)}%</span>
                            <div style={{ background: tone.bg, color: tone.fg, padding: '4px 10px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                              {tone.label}
                            </div>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.06)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${Math.max(2, percentage)}%`, height: '100%', background: tone.bar, borderRadius: '5px', transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px', paddingLeft: isModal ? '20px' : '8px' }}>Average Packs per Rarity</h3>
              <div className={isModal ? 'ios-card' : 'data-card'} style={!isModal ? { background: 'var(--card-bg, rgba(255,255,255,0.7))', borderRadius: 'var(--radius-lg)', overflow: 'hidden' } : { borderRadius: '20px', overflow: 'hidden', border: 'var(--card-border, 1px solid rgba(0,0,0,0.05))', background: 'var(--card-bg, #fff)', padding: 0, width: '100%', display: 'block' }}>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '300px' }}>
                    <thead>
                      <tr style={{ borderBottom: 'var(--card-border, 2px solid rgba(0,0,0,0.05))' }}>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Rarity</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{blended ? 'All packs' : 'Standard'}<br /><span style={{ fontSize: '0.7rem', fontWeight: 400 }}>Packs/rarity</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map(({ id, icon, prob }, index) => (
                        <tr key={id} style={{ borderBottom: index === displayRows.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding: '16px 20px', textAlign: 'left' }}>
                            <div dangerouslySetInnerHTML={{ __html: icon }} style={{ height: '24px', display: 'flex', alignItems: 'center' }} />
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem' }}>
                            {prob > 0 ? (1 / prob).toFixed(1) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={isModal ? 'ios-card' : 'calc-empty'} style={!isModal ? { padding: '100px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 } : { padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, justifyContent: 'center' }}>
            The Rotom Dex is standing by... enter your pulls to begin!
          </div>
        )}
      </div>
    </div>
  );
}

export default Calculator;
