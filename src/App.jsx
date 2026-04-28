import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import { PACKS, RARITIES, ICONS } from './data';
import { runLuckCalculation } from './math';

function App() {
  const [view, setView] = useState('home');
  const [history, setHistory] = useState([]);
  const [dexSelectedPack, setDexSelectedPack] = useState(null);

  const handleSetView = (newView) => {
    if (newView === view) return;
    setHistory(prev => [...prev, view]);
    setView(newView);
    setDexSelectedPack(null);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (view === 'dex' && dexSelectedPack) {
      setDexSelectedPack(null);
      window.scrollTo(0, 0);
      return;
    }
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setView(prev);
      setDexSelectedPack(null);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <div className="ambient-background">
        <div className="ambient-blob blob-1"></div>
        <div className="ambient-blob blob-2"></div>
        <div className="ambient-blob blob-3"></div>
      </div>

      {(history.length > 0 || dexSelectedPack) && (
        <button onClick={handleBack} className="ios-back-btn">
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
            <path d="M10 1L2 10L10 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      )}

      <nav className="nav-ultra">
        {['home', 'calc', 'dex'].map(v => (
          <button key={v} className={`nav-pill ${view === v ? 'active' : ''}`} onClick={() => handleSetView(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <div style={{ paddingTop: '100px', paddingBottom: '100px', maxWidth: '1400px', margin: '0 auto', paddingLeft: '5%', paddingRight: '5%' }}>

        {/* HOME VIEW */}
        {view === 'home' && <LandingPage setView={handleSetView} />}

        {/* CALCULATOR VIEW (Always Global Pool) */}
        {view === 'calc' && (
          <Calculator mode="overall" selectedPack={PACKS[0]} />
        )}

        {/* DEX VIEW */}
        {view === 'dex' && (
          <>
            <div className="animate-enter">
              <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '60px', flexWrap: 'wrap' }}>
                <img src="/images/pocket_logo.webp" alt="Dex" style={{ width: '120px', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} />
                <div>
                  <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">The Archives</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '12px', fontWeight: 500, maxWidth: '600px' }}>
                    Explore the explicit sub-rates and rules for all {PACKS.length} official Pokémon TCG Pocket expansions currently tracked by the engine.
                  </p>
                </div>
              </div>

              <div className="archives-grid" style={{ display: 'grid', gap: '32px' }}>
                {PACKS.map(p => (
                  <div key={p.id} className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                      {p.img && <img src={p.img} alt={p.name} style={{ width: '100%', maxWidth: '200px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} />}
                      <div style={{ width: '100%', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.04em', marginBottom: '8px' }}>{p.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Released: {p.date}</div>
                      </div>
                    </div>
                    <button className="btn-super" style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'var(--text-main)', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} onClick={() => setDexSelectedPack(p)}>
                      Open & Calculate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* iOS Bottom Sheet Modal */}
            {dexSelectedPack && (
              <div className="ios-backdrop" onClick={() => setDexSelectedPack(null)}>
                <div className="ios-bottom-sheet" onClick={e => e.stopPropagation()}>
                  
                  <div className="sheet-header">
                    <div className="drag-indicator"></div>
                    <button className="ios-close-btn" onClick={() => setDexSelectedPack(null)}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M1 1L13 13M1 13L13 1"/>
                      </svg>
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {dexSelectedPack.img && <img src={dexSelectedPack.img} alt={dexSelectedPack.name} style={{ width: '60px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />}
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em', margin: 0, color: 'var(--text-main)' }}>{dexSelectedPack.name}</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '2px', fontWeight: 500 }}>Calculator Instance</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="sheet-content">
                    <Calculator mode="perset" selectedPack={dexSelectedPack} isModal={true} />
                  </div>
                  
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </>
  );
}

function Calculator({ mode, selectedPack, isModal }) {
  const [packsOpened, setPacksOpened] = useState(0);
  const [deluxePacksOpened, setDeluxePacksOpened] = useState(0);
  const [counts, setCounts] = useState({});
  const [results, setResults] = useState(null);
  
  const resultsRef = useRef(null);

  const adjustPacks = (val) => setPacksOpened(prev => Math.max(0, prev + val));
  const adjustDeluxePacks = (val) => setDeluxePacksOpened(prev => Math.max(0, prev + val));
  const adjustRarity = (id, val) => setCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + val) }));
  const setRarity = (id, val) => setCounts(prev => ({ ...prev, [id]: Math.max(0, val) }));

  const calculate = (isAuto = false) => {
    if (packsOpened <= 0 && deluxePacksOpened <= 0) { 
      if (!isAuto) alert('Please enter packs opened.'); 
      return; 
    }
    setResults(runLuckCalculation(packsOpened, counts, mode, selectedPack, deluxePacksOpened));
    
    if (!isAuto) {
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (results) {
      calculate(true);
    }
  }, [packsOpened, deluxePacksOpened, counts, mode, selectedPack]);

  return (
    <div className={`layout-grid animate-enter ${isModal ? 'ios-mode' : ''}`}>
      <div className={isModal ? "ios-section" : "glass-panel"}>
        <h2 className={isModal ? "ios-section-header" : "text-gradient"} style={!isModal ? { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' } : {}}>Trainer's Log</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isModal ? '16px' : '32px' }}>
          <div className={isModal ? "ios-card" : ""} style={!isModal ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' } : {}}>
            <div>
              <div style={{ fontWeight: 700, fontSize: isModal ? '1.1rem' : '1.4rem' }}>{mode === 'overall' ? 'Standard Packs' : 'Total Packs'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Enter the exact number opened</div>
            </div>
            <div className="stepper-ultra">
              <button className="stepper-btn" onClick={() => adjustPacks(-10)}>-</button>
              <input type="text" className="stepper-input" value={packsOpened} onChange={e => setPacksOpened(Math.max(0, parseInt(e.target.value) || 0))} />
              <button className="stepper-btn" onClick={() => adjustPacks(10)}>+</button>
            </div>
          </div>
          
          {mode === 'overall' && (
            <div className={isModal ? "ios-card" : ""} style={!isModal ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' } : {}}>
              <div>
                <div style={{ fontWeight: 700, fontSize: isModal ? '1.1rem' : '1.4rem' }}>Deluxe ex Packs</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>These guarantee an ex, handled separately!</div>
              </div>
              <div className="stepper-ultra">
                <button className="stepper-btn" onClick={() => adjustDeluxePacks(-10)}>-</button>
                <input type="text" className="stepper-input" value={deluxePacksOpened} onChange={e => setDeluxePacksOpened(Math.max(0, parseInt(e.target.value) || 0))} />
                <button className="stepper-btn" onClick={() => adjustDeluxePacks(10)}>+</button>
              </div>
            </div>
          )}

          <div className="rarity-grid" style={{ marginTop: isModal ? '0' : '20px' }}>
            {!(mode === 'perset' && selectedPack?.id === 'deluxe') && (
              <div className="glass-card" style={{ padding: '24px 10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div dangerouslySetInnerHTML={{ __html: ICONS.god }} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.5)' }} />
                <div style={{ fontWeight: 700, margin: '20px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>God Pack</div>
                <div className="stepper-ultra" style={{ padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('godPack', -1)}>-</button>
                  <input type="text" className="stepper-input" style={{ width: '100%', minWidth: 0, fontSize: '1.1rem', padding: 0 }} value={counts.godPack || 0} onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(v)) setRarity('godPack', v); }} />
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('godPack', 1)}>+</button>
                </div>
              </div>
            )}

            {mode === 'perset' && selectedPack?.id === 'megashine' && (
              <div className="glass-card" style={{ padding: '24px 10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div dangerouslySetInnerHTML={{ __html: ICONS.god }} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.5)', filter: 'hue-rotate(180deg)' }} />
                <div style={{ fontWeight: 700, margin: '20px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Shiny God Pack</div>
                <div className="stepper-ultra" style={{ padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('shinyGodPack', -1)}>-</button>
                  <input type="text" className="stepper-input" style={{ width: '100%', minWidth: 0, fontSize: '1.1rem', padding: 0 }} value={counts.shinyGodPack || 0} onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(v)) setRarity('shinyGodPack', v); }} />
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('shinyGodPack', 1)}>+</button>
                </div>
              </div>
            )}

            {RARITIES.filter(r => {
              const isDeluxe = mode === 'perset' && selectedPack?.id === 'deluxe';
              if (isDeluxe && r.id === 's1') return false;
              return !r.shinyOnly || mode === 'overall' || selectedPack.hasShiny;
            }).map(r => (
              <div key={r.id} className="glass-card" style={{ padding: '24px 10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div dangerouslySetInnerHTML={{ __html: r.icon }} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.5)' }} />
                <div style={{ fontWeight: 700, margin: '20px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.name}</div>
                <div className="stepper-ultra" style={{ padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity(r.id, -1)}>-</button>
                  <input type="text" className="stepper-input" style={{ width: '100%', minWidth: 0, fontSize: '1.1rem', padding: 0 }} value={counts[r.id] || 0} onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(v)) setRarity(r.id, v); }} />
                  <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity(r.id, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-super" onClick={() => calculate(false)} style={{ width: '100%', marginTop: '20px' }}>
            Evaluate Pulls!
          </button>
        </div>
      </div>

      <div ref={resultsRef} className={isModal ? "ios-section" : "glass-panel sticky-panel"}>
        <h2 className={isModal ? "ios-section-header" : "text-gradient"} style={!isModal ? { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' } : {}}>Professor's Evaluation</h2>
        {results ? (
          <div className="animate-enter">
            <div className="score-card" style={isModal ? { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px', marginBottom: '16px' } : {}}>
              <div className={`score-value ${results.score >= 7 ? 'text-gradient-red' : ''}`} style={results.score < 7 ? { background: 'linear-gradient(135deg, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}}>
                {results.score.toFixed(1)} <span style={{ fontSize: '0.4em', color: '#888' }}>/ 10</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.6rem', marginTop: '16px', letterSpacing: '-0.02em', color: '#fff' }}>
                {(() => {
                  const s = results.score;
                  if (s >= 8.5) return "Legendary";
                  if (s >= 7) return "Lucky";
                  if (s >= 5) return "Average";
                  if (s >= 3.5) return "Unlucky";
                  return "Cursed";
                })()}
              </div>
              <div style={{ fontSize: '1.1rem', marginTop: '12px', color: '#86868b', fontWeight: 600, fontStyle: 'italic', padding: '0 20px', lineHeight: 1.4 }}>
                "{(() => {
                  const s = results.score;
                  if (s >= 8.5) return "Arceus himself smiles upon you.";
                  if (s >= 7) return "Clearly above what probability predicts.";
                  if (s >= 5) return "Right in line with expected pull rates.";
                  if (s >= 3.5) return "Below average — variance is a cruel thing.";
                  return "The gacha gods have abandoned you.";
                })()}"
              </div>
            </div>

            <div className={isModal ? "ios-card" : ""} style={!isModal ? { background: 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-lg)', padding: '0 24px' } : { display: 'flex', flexDirection: 'column', padding: '12px 24px', gap: '0', alignItems: 'stretch' }}>
              {results.results.map(({ r, got, exp }) => (
                <div key={r.id} className="breakdown-row">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{r.name}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>Expected: {exp.toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', color: got > exp ? 'var(--accent)' : 'var(--text-main)' }}>{got}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={isModal ? "ios-card" : ""} style={!isModal ? { padding: '100px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 } : { padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, justifyContent: 'center' }}>
            The Rotom Dex is standing by... enter your pulls to begin!
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

function LandingPage({ setView }) {
  const container = useRef(null);

  useGSAP(() => {
    // Hero Entrance
    gsap.from('.hero-text > *', {
      y: 50,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: 'power3.out'
    });

    // Device Showcase Pin
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.pin-wrap',
        start: 'top top',
        end: '+=3000', // Scroll for 3000px to see the animation
        scrub: 1,
        pin: true
      }
    });

    // Image & Text Sequence
    tl.to('.text-step-1', { opacity: 0, y: -50, duration: 1 })
      .to('.img-step-1', { opacity: 0, scale: 1.1, duration: 1 }, "<")
      .fromTo('.text-step-2', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1 }, "<")
      .fromTo('.img-step-2', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 1 }, "<")
      
      .to({}, {duration: 0.5}) // pause

      .to('.text-step-2', { opacity: 0, y: -50, duration: 1 })
      .to('.img-step-2', { opacity: 0, scale: 1.1, duration: 1 }, "<")
      .fromTo('.text-step-3', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1 }, "<")
      .fromTo('.img-step-3', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 1 }, "<")
      
      .to({}, {duration: 0.5}); // pause

    // Simple Grid Reveal
    gsap.from('.simple-reveal-card', {
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.simple-reveal-grid',
        start: 'top 80%'
      }
    });

    // Final CTA Scale
    gsap.from('.final-cta', {
      scale: 0.95,
      opacity: 0,
      duration: 1.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.final-cta',
        start: 'top 85%'
      }
    });

  }, { scope: container, dependencies: [] });

  return (
    <div ref={container} style={{ overflowX: 'hidden', position: 'relative' }}>
      
      {/* Hero Section */}
      <section style={{ textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingTop: '80px', paddingBottom: '80px', position: 'relative' }} className="hero-text">
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', zIndex: -1, opacity: 0.8, filter: 'blur(30px)' }}>
          <img src="/images/glass_pokeball.png" alt="Pokeball Glow" style={{ width: '400px' }} />
        </div>
        <img src="/images/pocket_logo.webp" alt="Pokemon TCG Pocket" className="floating-card" style={{ width: '120px', height: '120px', objectFit: 'cover', marginBottom: '32px', zIndex: 1, borderRadius: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }} />
        <h1 className="hero-large text-gradient" style={{ marginBottom: '24px', zIndex: 1 }}>
          Track Your Daily Pulls.<br />
          <span className="text-dynamic">Master the Wonder Pick.</span>
        </h1>
        <p className="section-subtitle" style={{ maxWidth: '700px', margin: '0 auto 48px', zIndex: 1 }}>
          The ultimate analytical companion for Pokémon TCG Pocket. Calculate the exact odds of your daily booster packs and Wonder Picks.
        </p>
        <button className="btn-super" onClick={() => { setView('calc'); window.scrollTo(0,0); }} style={{ transform: 'scale(1.1)', zIndex: 1 }}>
          Access the Rotom Dex
        </button>
      </section>

      {/* Scroll-Immersive Device Showcase */}
      <section className="pin-wrap">
        <div className="pin-content">
          
          <div className="pin-text">
            <div style={{ position: 'relative', width: '100%', height: '250px' }}>
              <div className="text-step-1" style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
                <h2 className="section-title text-gradient">Analyze Daily Packs.</h2>
                <p className="section-subtitle">Log your two daily booster packs. Our engine maps directly to official Genetic Apex sub-rates.</p>
              </div>
              <div className="text-step-2" style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0 }}>
                <h2 className="section-title text-gradient">Wonder Pick Analytics.</h2>
                <p className="section-subtitle">Did you really get lucky pulling that Charizard ex from a Wonder Pick? Find out instantly.</p>
              </div>
              <div className="text-step-3" style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0 }}>
                <h2 className="section-title text-gradient">Hunt Immersive Art.</h2>
                <p className="section-subtitle">Calculate the precise Z-Score of pulling ultra-rare, 3D immersive cards compared to the global player base.</p>
              </div>
            </div>
          </div>

          <div className="pin-image-container">
            <div className="phone-frame">
              <div className="phone-screen">
                <img src="/images/screen1.jpeg" alt="Pack Opening" className="img-step-1" />
                <img src="/images/screen2.jpeg" alt="Card Binder" className="img-step-2" style={{ opacity: 0 }} />
                <img src="/images/screen3.jpeg" alt="Statistics" className="img-step-3" style={{ opacity: 0 }} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Thematic Feature Section - Simple Reveal */}
      <section style={{ padding: '150px 5%', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 className="hero-large" style={{ color: '#1d1d1f', marginBottom: '16px' }}>Data-Driven.</h2>
            <h2 className="hero-large" style={{ color: 'var(--accent)', marginBottom: '24px' }}>Trainer Approved.</h2>
            <p className="section-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>No more guessing. No more myths. Decode the exact mathematical standings of the entire global playerbase.</p>
          </div>

          <div className="simple-reveal-grid archives-grid" style={{ display: 'grid', gap: '40px' }}>
            
            <div className="simple-reveal-card" style={{ background: '#fff', borderRadius: '40px', padding: '60px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, #1d1d1f, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>100%</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d1d1f', marginBottom: '16px' }}>Client-Side Speed</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>Zero loading screens. Calculations run instantly directly in your browser.</p>
            </div>

            <div className="simple-reveal-card" style={{ background: '#fff', borderRadius: '40px', padding: '60px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, #1d1d1f, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>Live</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d1d1f', marginBottom: '16px' }}>Expansion Tracking</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>Algorithms dynamically adapt to the specific expansion you are opening.</p>
            </div>

            <div className="simple-reveal-card" style={{ background: '#1d1d1f', borderRadius: '40px', padding: '60px', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, var(--accent), #ff9eb5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>Pro</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>Rotom Analytics</h3>
              <p style={{ color: '#86868b', fontSize: '1.1rem', lineHeight: 1.5 }}>Receive a personalized Professor's Evaluation based on your precise Z-Score.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '150px 5%' }}>
        <div className="final-cta" style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center', padding: '120px 20px', background: '#000', borderRadius: '60px', color: '#fff' }}>
          <h2 className="hero-large" style={{ color: '#fff', marginBottom: '24px' }}>Ready to test your luck?</h2>
          <p className="section-subtitle" style={{ color: '#86868b', maxWidth: '600px', margin: '0 auto 40px' }}>
            Join thousands of trainers tracking their true luck reality today.
          </p>
          <button className="btn-super" onClick={() => { setView('calc'); window.scrollTo(0,0); }} style={{ transform: 'scale(1.2)' }}>
            Launch the Rotom Dex
          </button>
        </div>
      </section>

    </div>
  );
}
