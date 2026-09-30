import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
        <div className="hero-glow" style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', zIndex: -1, opacity: 0.8, filter: 'blur(30px)' }}>
          <img src="/images/glass_pokeball.png" alt="Pokeball Glow" style={{ width: '400px' }} />
        </div>
        <img src="/images/pocket_logo.webp" alt="Pokemon TCG Pocket" className="floating-card" style={{ width: '120px', height: '120px', objectFit: 'cover', marginBottom: '32px', zIndex: 1, borderRadius: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }} />
        <h1 className="hero-large text-gradient" style={{ marginBottom: '24px', zIndex: 1 }}>
          Calculate Your Pack Luck.<br />
          <span className="text-dynamic">Defeat the Gacha.</span>
        </h1>
        <p className="section-subtitle" style={{ maxWidth: '700px', margin: '0 auto 48px', zIndex: 1 }}>
          The ultimate analytical companion for Pokémon TCG Pocket. Calculate the exact odds of your booster packs and discover your true luck score.
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
                <p className="section-subtitle">Log your daily booster packs. Our engine maps directly to official expansion sub-rates.</p>
              </div>
              <div className="text-step-2" style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0 }}>
                <h2 className="section-title text-gradient">Evaluate Your Luck.</h2>
                <p className="section-subtitle">Did you really get lucky pulling that Charizard ex? Find out instantly with our Z-Score engine.</p>
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
            <h2 className="hero-large" style={{ color: 'var(--text-main)', marginBottom: '16px' }}>Calculate.</h2>
            <h2 className="hero-large" style={{ color: 'var(--accent)', marginBottom: '24px' }}>Evaluate Luck.</h2>
            <p className="section-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>No more guessing. No more myths. Decode the exact mathematical luck of your Pokémon TCG Pocket pulls.</p>
          </div>

          <div className="simple-reveal-grid archives-grid" style={{ display: 'grid', gap: '40px' }}>
            
            <div className="simple-reveal-card" style={{ background: '#fff', borderRadius: '40px', padding: '60px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, #1d1d1f, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>Pure</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>Math Engine</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>Calculates your exact luck using standard deviations and Poisson distribution.</p>
            </div>

            <div className="simple-reveal-card" style={{ background: '#fff', borderRadius: '40px', padding: '60px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, #1d1d1f, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>All</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>Pack Sets</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>Supports overall blended calculations or specific pack probabilities.</p>
            </div>

            <div className="simple-reveal-card" style={{ background: '#1d1d1f', borderRadius: '40px', padding: '60px', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '5rem', fontWeight: 800, marginBottom: '16px', background: 'linear-gradient(135deg, var(--accent), #ff9eb5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>1-10</div>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>Luck Score</h3>
              <p style={{ color: '#86868b', fontSize: '1.1rem', lineHeight: 1.5 }}>Receive a personalized 1 to 10 score evaluating your exact pack luck.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '150px 5%' }}>
        <div className="final-cta" style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center', padding: '120px 20px', borderRadius: '60px' }}>
          <h2 className="hero-large" style={{ marginBottom: '24px' }}>Ready to test your luck?</h2>
          <p className="section-subtitle cta-subtitle" style={{ maxWidth: '600px', margin: '0 auto 40px' }}>
            Join thousands of trainers tracking their true luck reality today.
          </p>
          <button className="btn-super cta-btn" onClick={() => { setView('calc'); window.scrollTo(0,0); }} style={{ transform: 'scale(1.2)' }}>
            Launch the Rotom Dex
          </button>
        </div>
      </section>

    </div>
  );
}

export default LandingPage;
