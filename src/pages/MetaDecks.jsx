import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLiveMetaDecks } from '../services/MetaDecksService';
import PokemonCard from '../components/PokemonCard';
import { X } from 'lucide-react';
import './MetaDecks.css';

const MetaDecks = () => {
  const [metaDecks, setMetaDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState(null);

  useEffect(() => {
    getLiveMetaDecks()
      .then(setMetaDecks)
      .catch(() => setMetaDecks([]))
      .finally(() => setLoading(false));
  }, []);

  // Live decks already carry exact name/set/number/image per card, so no
  // fuzzy name-matching is needed here.
  const resolveDeckCards = (deckCards) => deckCards.map(dc => ({ card: dc, count: dc.count }));

  const getCardImage = (deck) => deck.cards[0]?.artUrl || null;

  const handleDeckClick = (deck) => {
    setSelectedDeck(deck);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  const closeModal = () => {
    setSelectedDeck(null);
    document.body.style.overflow = 'unset';
  };

  return (
    <div className="meta-decks-page animate-enter">
      <div className="glass-panel meta-header" style={{ display: 'flex', gap: '30px', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="Meta Decks" className="meta-logo" />
        <div>
          <h2 className="text-gradient meta-title">Meta Decks</h2>
          <p className="meta-subtitle">
            Explore the top-performing decks in the current meta. Click on a deck to view its full card list.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading database...</div>
      ) : (
        <div className="decks-grid">
          {metaDecks.map((deck) => {
            const mainImgUrl = getCardImage(deck);
            return (
              <div key={deck.id} className="deck-grid-item" onClick={() => handleDeckClick(deck)}>
                <div className="deck-item-header">
                  <span className={`ios-pill tier-pill ${deck.tier.toLowerCase().replace('/', '-')}`}>{deck.tier}</span>
                  <span className={`ios-pill type-pill type-${deck.type.toLowerCase()}`}>{deck.type}</span>
                </div>
                <div className="deck-title-row">
                  {mainImgUrl && (
                    <img src={mainImgUrl} alt={deck.name} className="deck-main-avatar" loading="lazy" />
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
              </div>
            );
          })}
        </div>
      )}

      {selectedDeck && (
        createPortal(
          <div className="deck-modal-scroll-container animate-fade-in" onClick={closeModal} data-lenis-prevent="true">
            <div className="deck-modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <button className="deck-modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
              
              <div className="deck-modal-header">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                  <span className={`ios-pill tier-pill ${selectedDeck.tier.toLowerCase().replace('/', '-')}`}>{selectedDeck.tier}</span>
                  <span className={`ios-pill type-pill type-${selectedDeck.type.toLowerCase()}`}>{selectedDeck.type}</span>
                </div>
                <h2 className="deck-modal-title">{selectedDeck.name}</h2>
                <p className="deck-modal-desc">{selectedDeck.description}</p>
              </div>

              <div className="deck-modal-cards-grid">
                {resolveDeckCards(selectedDeck.cards).map((rc, idx) => (
                  <div className="deck-modal-card-wrapper" key={idx}>
                    <PokemonCard card={rc.card} count={rc.count} />
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default MetaDecks;
