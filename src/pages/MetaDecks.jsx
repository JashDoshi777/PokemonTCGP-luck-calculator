import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getLiveMetaDecks } from '../services/MetaDecksService';
import { useDialog } from '../hooks/useDialog';
import PokemonCard from '../components/PokemonCard';
import { X } from 'lucide-react';
import './MetaDecks.css';

const tierClass = (tier) => tier.toLowerCase().replace('/', '-');

function DeckModal({ deck, onClose }) {
  const dialogRef = useDialog(onClose);

  // Keep the page behind from scrolling while the popup is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="deck-modal-scroll-container animate-fade-in" onClick={onClose} data-lenis-prevent="true">
      <div
        className="deck-modal-content animate-slide-up"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <button className="deck-modal-close" onClick={onClose} aria-label="Close deck">
          <X size={24} />
        </button>

        <div className="deck-modal-header">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <span className={`ios-pill tier-pill ${tierClass(deck.tier)}`}>{deck.tier}</span>
            <span className={`ios-pill type-pill type-${deck.type.toLowerCase()}`}>{deck.type}</span>
          </div>
          <h2 className="deck-modal-title" id="deck-modal-title">{deck.name}</h2>
          <p className="deck-modal-desc">{deck.description}</p>
        </div>

        <div className="deck-modal-cards-grid">
          {deck.cards.map((card, idx) => (
            <div className="deck-modal-card-wrapper" key={`${card.set}-${card.number}-${idx}`}>
              <PokemonCard card={card} count={card.count} />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

const MetaDecks = () => {
  const [metaDecks, setMetaDecks] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [selectedDeck, setSelectedDeck] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    getLiveMetaDecks()
      .then(decks => {
        if (cancelled) return;
        setMetaDecks(decks);
        setStatus('ready');
      })
      .catch(err => {
        console.error('Could not load the meta decks', err);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="meta-decks-page animate-enter">
      <div className="glass-panel meta-header" style={{ display: 'flex', gap: '30px', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="" className="meta-logo" />
        <div>
          <h2 className="text-gradient meta-title">Meta Decks</h2>
          <p className="meta-subtitle">
            Explore the top-performing decks in the current meta. Click on a deck to view its full card list.
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }} role="status">Loading the latest meta…</div>
      )}

      {status === 'error' && (
        <div className="glass-card meta-empty" role="alert">
          <h3>We couldn't load the meta decks.</h3>
          <p>The live data source may be briefly unavailable. Check your connection and try again.</p>
          <button className="btn-super" style={{ padding: '10px 24px' }} onClick={load}>Try again</button>
        </div>
      )}

      {status === 'ready' && metaDecks.length === 0 && (
        <div className="glass-card meta-empty">
          <h3>No decks to show right now.</h3>
          <p>The meta list is being refreshed. Please check back soon.</p>
        </div>
      )}

      {status === 'ready' && metaDecks.length > 0 && (
        <div className="decks-grid">
          {metaDecks.map((deck) => {
            const mainImgUrl = deck.cards[0]?.artUrl || null;
            return (
              <button type="button" key={deck.id} className="deck-grid-item" onClick={() => setSelectedDeck(deck)} aria-label={`View ${deck.name} deck`}>
                <div className="deck-item-header">
                  <span className={`ios-pill tier-pill ${tierClass(deck.tier)}`}>{deck.tier}</span>
                  <span className={`ios-pill type-pill type-${deck.type.toLowerCase()}`}>{deck.type}</span>
                </div>
                <div className="deck-title-row">
                  {mainImgUrl && (
                    <img src={mainImgUrl} alt="" className="deck-main-avatar" loading="lazy" />
                  )}
                  <div>
                    <h3 className="deck-item-name">{deck.name}</h3>
                  </div>
                </div>
                <p className="deck-item-desc">{deck.description}</p>
                <div className="deck-item-footer">
                  <span className="deck-card-count">{deck.cards.reduce((acc, c) => acc + c.count, 0)} Cards</span>
                  <span className="view-details-text">View Deck →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedDeck && <DeckModal deck={selectedDeck} onClose={() => setSelectedDeck(null)} />}
    </div>
  );
};

export default MetaDecks;
