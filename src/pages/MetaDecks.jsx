import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { META_DECKS } from '../data/metaDecks';
import PokemonCard from '../components/PokemonCard';
import { X } from 'lucide-react';
import './MetaDecks.css';

const MetaDecks = () => {
  const { cards, loading } = useAppContext();
  const [selectedDeck, setSelectedDeck] = useState(null);

  const findFuzzyCard = (cardName) => {
    if (!cards || cards.length === 0) return null;
    
    const normalize = (str) => str.toLowerCase().replace(/['’]/g, "'");
    const normalizedTarget = normalize(cardName);
    
    let found = cards.find(c => normalize(c.name) === normalizedTarget);
    if (found) return found;
    
    // Fallback: strip common prefixes/suffixes to find base Pokémon
    const cleanName = normalizedTarget.replace(/mega | ex| v| vmax| vstar/gi, '').trim();
    found = cards.find(c => normalize(c.name).includes(cleanName));
    return found;
  };

  const resolveDeckCards = (deckCards) => {
    if (!cards || cards.length === 0) return [];
    return deckCards.map(dc => {
      const foundCard = findFuzzyCard(dc.name);
      return {
        card: foundCard || { name: dc.name, number: '999', set: 'CUSTOM' },
        count: dc.count
      };
    });
  };

  const getCardImage = (cardName) => {
    const foundCard = findFuzzyCard(cardName);
    if (!foundCard) return null; // If absolutely no matching image can be found
    let cardNumberStr = foundCard.number ? foundCard.number.toString() : '1';
    if (cardNumberStr.includes('/')) cardNumberStr = cardNumberStr.split('/')[0];
    const setCode = foundCard.set || 'A1';
    return `https://cdn.jsdelivr.net/gh/flibustier/pokemon-tcg-exchange@main/public/images/cards-by-set/${setCode}/${cardNumberStr}.webp`;
  };

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
          {META_DECKS.map((deck) => {
            const mainImgUrl = getCardImage(deck.cards[0].name);
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
        <div className="deck-modal-scroll-container animate-fade-in" onClick={closeModal}>
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
        </div>
      )}
    </div>
  );
};

export default MetaDecks;
