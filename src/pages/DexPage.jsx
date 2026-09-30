import React from 'react';
import PackImage from '../components/PackImage';
import Calculator from './Calculator';
import { useDialog } from '../hooks/useDialog';

// The pack's own calculator, presented as an iOS-style bottom sheet.
function PackSheet({ pack, onClose }) {
  const dialogRef = useDialog(onClose);

  return (
    <div className="ios-backdrop" onClick={onClose} data-lenis-prevent="true">
      <div
        className="ios-bottom-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${pack.name} calculator`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-header">
          <div className="drag-indicator"></div>
          <button className="ios-close-btn" onClick={onClose} aria-label="Close calculator">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M1 1L13 13M1 13L13 1" />
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <PackImage pack={pack} style={{ width: '60px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em', margin: 0, color: 'var(--text-main)' }}>{pack.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '2px', fontWeight: 500 }}>Calculator Instance</p>
            </div>
          </div>
        </div>

        <div className="sheet-content" data-lenis-prevent="true">
          <Calculator mode="perset" selectedPack={pack} isModal={true} />
        </div>
      </div>
    </div>
  );
}

const DexPage = ({ packs, selectedPack, onSelectPack, onClosePack }) => (
  <>
    <div className="animate-enter">
      <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '60px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="" style={{ width: '120px', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} />
        <div>
          <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">The Archives</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '12px', fontWeight: 500, maxWidth: '600px' }}>
            Explore the explicit sub-rates and rules for all {packs.length} official Pokémon TCG Pocket expansions currently tracked by the engine.
          </p>
        </div>
      </div>

      <div className="archives-grid" style={{ display: 'grid', gap: '32px' }}>
        {packs.map(p => (
          <div key={p.id} className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <PackImage pack={p} style={{ width: '100%', maxWidth: '200px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} />
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.04em', marginBottom: '8px' }}>{p.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Released: {p.date}</div>
              </div>
            </div>
            <button
              className="btn-super"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'var(--text-main)', color: 'var(--btn-text, #fff)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
              onClick={() => onSelectPack(p)}
              aria-label={`Open and calculate ${p.name}`}
            >
              Open & Calculate
            </button>
          </div>
        ))}
      </div>
    </div>

    {selectedPack && <PackSheet pack={selectedPack} onClose={onClosePack} />}
  </>
);

export default DexPage;
