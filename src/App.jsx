import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import { PACKS, RARITIES, ICONS } from './data';
import { runLuckCalculation } from './math';

function App() {
  const [view, setView] = useState('home');
  const [mode, setMode] = useState('overall');
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);
  const [packsOpened, setPacksOpened] = useState(0);
  const [counts, setCounts] = useState({});
  const [results, setResults] = useState(null);

  const adjustPacks = (val) => setPacksOpened(prev => Math.max(0, prev + val));
  const adjustRarity = (id, val) => setCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + val) }));
  const setRarity = (id, val) => setCounts(prev => ({ ...prev, [id]: Math.max(0, val) }));

  const calculate = () => {
    if (packsOpened <= 0) { alert('Please enter packs opened.'); return; }
    setResults(runLuckCalculation(packsOpened, counts, mode, selectedPack));
    setView('calc');
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div className="ambient-background">
        <div className="ambient-blob blob-1"></div>
        <div className="ambient-blob blob-2"></div>
        <div className="ambient-blob blob-3"></div>
      </div>

      <nav className="nav-ultra">
        {['home', 'calc', 'dex'].map(v => (
          <button key={v} className={`nav-pill ${view === v ? 'active' : ''}`} onClick={() => { setView(v); window.scrollTo(0, 0); }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <div style={{ paddingTop: '100px', paddingBottom: '100px', maxWidth: '1400px', margin: '0 auto', paddingLeft: '5%', paddingRight: '5%' }}>

        {/* HOME VIEW */}
        {view === 'home' && <LandingPage setView={setView} />}

        {/* CALCULATOR VIEW */}
        {view === 'calc' && (
          <div className="layout-grid animate-enter">
            <div className="glass-panel">
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' }} className="text-gradient">Trainer's Log</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>Total Packs</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Enter the exact number opened</div>
                  </div>
                  <div className="stepper-ultra">
                    <button className="stepper-btn" onClick={() => adjustPacks(-10)}>-</button>
                    <input type="text" className="stepper-input" value={packsOpened} onChange={e => setPacksOpened(Math.max(0, parseInt(e.target.value) || 0))} />
                    <button className="stepper-btn" onClick={() => adjustPacks(10)}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.4)', padding: '6px', borderRadius: '100px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.6)' }}>
                  <button className={`nav-pill ${mode === 'overall' ? 'active' : ''}`} onClick={() => setMode('overall')}>Global Pool</button>
                  <button className={`nav-pill ${mode === 'perset' ? 'active' : ''}`} onClick={() => setMode('perset')}>Specific Expansion</button>
                </div>

                {mode === 'perset' && (
                  <div style={{ marginBottom: '20px' }}>
                    <select
                      value={selectedPack.id}
                      onChange={e => setSelectedPack(PACKS.find(p => p.id === e.target.value))}
                      style={{ padding: '14px 20px', borderRadius: '100px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', outline: 'none', cursor: 'pointer', width: '100%', maxWidth: '300px', appearance: 'auto' }}
                    >
                      {PACKS.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.date})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rarity-grid" style={{ marginTop: '20px' }}>
                  <div className="glass-card" style={{ padding: '24px 10px' }}>
                    <div dangerouslySetInnerHTML={{ __html: ICONS.god }} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.5)' }} />
                    <div style={{ fontWeight: 700, margin: '24px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: 'center' }}>God Pack</div>
                    <div className="stepper-ultra" style={{ padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between' }}>
                      <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('godPack', -1)}>-</button>
                      <input type="text" className="stepper-input" style={{ width: '100%', minWidth: 0, fontSize: '1.1rem', padding: 0 }} value={counts.godPack || 0} onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(v)) setRarity('godPack', v); }} />
                      <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity('godPack', 1)}>+</button>
                    </div>
                  </div>

                  {RARITIES.filter(r => !r.shinyOnly || mode === 'overall' || selectedPack.hasShiny).map(r => (
                    <div key={r.id} className="glass-card" style={{ padding: '24px 10px' }}>
                      <div dangerouslySetInnerHTML={{ __html: r.icon }} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.5)' }} />
                      <div style={{ fontWeight: 700, margin: '24px 0 16px', fontSize: '1.05rem', letterSpacing: '-0.01em', textAlign: 'center' }}>{r.name}</div>
                      <div className="stepper-ultra" style={{ padding: '4px 6px', gap: '4px', width: '100%', justifyContent: 'space-between' }}>
                        <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity(r.id, -1)}>-</button>
                        <input type="text" className="stepper-input" style={{ width: '100%', minWidth: 0, fontSize: '1.1rem', padding: 0 }} value={counts[r.id] || 0} onChange={e => { const v = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(v)) setRarity(r.id, v); }} />
                        <button className="stepper-btn" style={{ width: '26px', height: '26px', fontSize: '1rem' }} onClick={() => adjustRarity(r.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn-super" onClick={calculate} style={{ width: '100%', marginTop: '20px' }}>
                  Evaluate Pulls!
                </button>
              </div>
            </div>

            <div className="glass-panel sticky-panel">
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' }} className="text-gradient">Professor's Evaluation</h2>
              {results ? (
                <div className="animate-enter">
                  <div className="score-card">
                    <div className={`score-value ${results.score > 1.5 ? 'text-gradient-red' : 'text-gradient'}`}>
                      {results.score > 0 ? '+' : ''}{results.score.toFixed(1)}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.6rem', marginTop: '16px', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                      Luck Rating
                    </div>
                    <div style={{ fontSize: '1.1rem', marginTop: '12px', color: 'var(--text-muted)', fontWeight: 600, fontStyle: 'italic', padding: '0 20px', lineHeight: 1.4 }}>
                      "{(() => {
                        const s = results.score;
                        if (s > 3) return "Master Ball Luck! Are you secretly Arceus?";
                        if (s > 1.5) return "Super Effective! The pulls are heating up.";
                        if (s > 0.5) return "Great pulls! Better than your average trainer.";
                        if (s > -0.5) return "Perfectly balanced. A true Normal-type experience.";
                        if (s > -1.5) return "Not very effective... Did Team Rocket rig these?";
                        if (s > -3) return "Critical Miss! Your luck is confused and hurt itself.";
                        return "Magikarp level luck... Just keep splashing.";
                      })()}"
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-lg)', padding: '0 24px' }}>
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
                <div style={{ padding: '100px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 }}>
                  The Rotom Dex is standing by... enter your pulls to begin!
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEX VIEW */}
        {view === 'dex' && (
          <div className="animate-enter">
            <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '60px', flexWrap: 'wrap' }}>
              <img src="/card_mockup.png" alt="Dex" style={{ width: '120px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} />
              <div>
                <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">The Archives</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '12px', fontWeight: 500, maxWidth: '600px' }}>
                  Explore the explicit sub-rates and rules for all {PACKS.length} official Pokémon TCG Pocket expansions currently tracked by the engine.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px' }}>
              {PACKS.map(p => (
                <div key={p.id} className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '24px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '8px' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Released: {p.date}</div>
                  </div>
                  <button className="btn-super" style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'var(--text-main)', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} onClick={() => { setView('calc'); setMode('perset'); setSelectedPack(p); window.scrollTo(0, 0); }}>
                    Open & Calculate
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
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

    // Banner Parallax
    gsap.to('.hero-banner-img', {
      yPercent: 20,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-banner-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    // Bento Grid Reveal
    gsap.from('.bento-box', {
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: '.bento-grid',
        start: 'top 85%'
      }
    });

    // Steps Reveal
    gsap.utils.toArray('.step-row').forEach((row, i) => {
      gsap.from(row, {
        x: i % 2 === 0 ? -50 : 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: row,
          start: 'top 80%'
        }
      });
    });

    // Final CTA Scale
    gsap.from('.final-cta', {
      scale: 0.8,
      opacity: 0,
      duration: 1.5,
      ease: 'elastic.out(1, 0.5)',
      scrollTrigger: {
        trigger: '.final-cta',
        start: 'top 90%'
      }
    });

  }, { scope: container, dependencies: [] });

  return (
    <div ref={container} style={{ paddingBottom: '100px', overflowX: 'hidden', position: 'relative' }}>
      
      {/* Ambient Animated Background */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      {/* Hero Section */}
      <section style={{ textAlign: 'center', margin: '80px 0 100px', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }} className="hero-text">
        <h1 style={{ fontSize: 'min(6rem, 15vw)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '24px' }} className="text-gradient">
          Track Your Pulls. <br />
          <span className="text-gradient-red">Find Your Luck.</span>
        </h1>
        <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto 48px', lineHeight: 1.5, fontWeight: 500 }}>
          The ultimate companion for Pokémon TCG Pocket. Log your booster packs, compare against official pull rates, and see if the RNG gods are with you.
        </p>
        <button className="btn-super" onClick={() => { setView('calc'); window.scrollTo(0,0); }} style={{ transform: 'scale(1.1)' }}>
          Access the Rotom Dex
        </button>

        <div style={{ marginTop: '60px', opacity: 0.6, animation: 'bounce 2s infinite' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Scroll to Explore</div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </section>

      {/* Hero Banner Replacement: High-Res Charizard Card */}
      <section className="hero-banner-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '600px', marginBottom: '150px', perspective: '1200px' }}>
        <img 
          src="/charizard.png" 
          alt="Charizard" 
          className="floating-card"
          style={{ width: 'auto', height: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: '4% / 3%', zIndex: 10 }} 
          onLoad={() => ScrollTrigger.refresh()}
        />
      </section>

      {/* Bento Grid */}
      <section style={{ marginBottom: '200px' }}>
        <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '60px' }} className="text-gradient">Uncover the Matrix.</h2>
        <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          {/* Card 1 */}
          <div className="glass-panel bento-box" style={{ padding: '0', display: 'flex', flexDirection: 'column', minHeight: '450px', background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%)', position: 'relative', overflow: 'hidden', borderRadius: '32px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(10,132,255,0.2), transparent 70%)', padding: '40px' }}>
               <img src="/pikachu.png" alt="Pikachu" style={{ width: 'auto', height: '100%', maxHeight: '200px', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))', transform: 'rotate(-5deg)' }} />
            </div>
            <div style={{ padding: '40px' }}>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Real-time Analytics</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontSize: '1.2rem', lineHeight: 1.5 }}>Live Z-Score engine instantly calculates if your pack luck is defying mathematical reality.</p>
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="glass-panel bento-box" style={{ padding: '0', display: 'flex', flexDirection: 'column', minHeight: '450px', background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%)', position: 'relative', overflow: 'hidden', borderRadius: '32px' }}>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(120,40,140,0.2), transparent 70%)', padding: '40px' }}>
               <img src="/mewtwo.png" alt="Mewtwo" style={{ width: 'auto', height: '100%', maxHeight: '200px', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))', transform: 'rotate(5deg)' }} />
            </div>
            <div style={{ padding: '40px' }}>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>100% Pokédex</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontSize: '1.2rem', lineHeight: 1.5 }}>Every official expansion rigorously mapped. From Genetic Apex to the newest drops.</p>
            </div>
          </div>
          
          {/* Card 3 */}
          <div className="glass-panel bento-box" style={{ padding: '0', display: 'flex', flexDirection: 'column', minHeight: '450px', background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%)', position: 'relative', overflow: 'hidden', borderRadius: '32px', gridColumn: '1 / -1' }}>
             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '300px', background: 'radial-gradient(ellipse at top, rgba(255,59,48,0.2), transparent 70%)' }}></div>
            <div style={{ padding: '60px', textAlign: 'center', maxWidth: '800px', margin: 'auto' }}>
              <h3 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)' }}>Zero Input Lag</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontSize: '1.4rem', lineHeight: 1.5 }}>A fully client-side math engine built for Arceus-tier speed. No loading screens, no server delays. Pure instant probability calculations directly in your browser.</p>
            </div>
          </div>

        </div>
      </section>

      {/* How it Works */}
      <section style={{ marginBottom: '200px', overflow: 'hidden' }}>
        <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '100px' }} className="text-gradient">The Path to Mastery.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '80px', maxWidth: '800px', margin: '0 auto' }}>
          <div className="step-row glass-panel" style={{ padding: '60px', display: 'flex', gap: '60px', alignItems: 'center', borderRadius: '32px' }}>
            <div style={{ fontSize: '8rem', fontWeight: 900, color: 'var(--accent)', opacity: 0.1, lineHeight: 0.8, flexShrink: 0 }}>01</div>
            <div>
              <h3 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Select Your Expansion</h3>
              <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.5 }}>Target a specific set from the Archives (like Genetic Apex), or calculate against the massive Global Pool.</p>
            </div>
          </div>

          <div className="step-row glass-panel" style={{ padding: '60px', display: 'flex', gap: '60px', alignItems: 'center', flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '32px' }}>
            <div style={{ fontSize: '8rem', fontWeight: 900, color: 'var(--accent)', opacity: 0.1, lineHeight: 0.8, flexShrink: 0 }}>02</div>
            <div>
              <h3 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Log Your Pulls</h3>
              <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.5 }}>Input the exact number of Booster Packs opened and tap the rarities you secured. The interface is built for speed.</p>
            </div>
          </div>

          <div className="step-row glass-panel" style={{ padding: '60px', display: 'flex', gap: '60px', alignItems: 'center', borderRadius: '32px', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))', border: '2px solid rgba(255,59,48,0.2)' }}>
            <div style={{ fontSize: '8rem', fontWeight: 900, color: 'var(--accent)', opacity: 1, lineHeight: 0.8, flexShrink: 0, textShadow: '0 10px 30px rgba(255,59,48,0.3)' }}>03</div>
            <div>
              <h3 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Face the Professor</h3>
              <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.5 }}>Get your personalized Luck Rating. Are you in the top 1% of lucky players, or did you get completely shafted by RNG?</p>
            </div>
          </div>

        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta" style={{ textAlign: 'center', padding: '120px 20px', background: 'rgba(255,255,255,0.6)', borderRadius: '40px', boxShadow: '0 40px 100px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(255,59,48,0.2) 0%, rgba(255,59,48,0) 70%)', filter: 'blur(60px)', zIndex: -1 }}></div>
        <h2 style={{ fontSize: 'min(4rem, 10vw)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '24px' }}>Ready to test your luck?</h2>
        <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 40px', fontWeight: 500 }}>
          Don't leave your pulls to chance. Start tracking your mathematical reality today.
        </p>
        <button className="btn-super" onClick={() => { setView('calc'); window.scrollTo(0,0); }} style={{ transform: 'scale(1.2)' }}>
          Begin Analysis
        </button>
      </section>

    </div>
  );
}
