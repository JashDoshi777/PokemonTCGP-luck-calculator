import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { META_DECKS } from '../data/metaDecks';
import PokemonCard from '../components/PokemonCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './MetaDecks.css';

const MetaDecks = () => {
  const { cards, loading } = useAppContext();

  const resolveDeckCards = (deckCards) => {
    if (!cards || cards.length === 0) return [];
    return deckCards.map(dc => {
      const foundCard = cards.find(c => c.name.toLowerCase() === dc.name.toLowerCase());
      return {
        card: foundCard || { name: dc.name, number: '1', set: 'A1' },
        count: dc.count
      };
    });
  };

  return (
    <div className="meta-decks-page animate-enter">
      <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '60px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="Meta Decks" style={{ width: '120px', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} />
        <div>
          <h2 style={{ fontSize: 'min(3rem, 10vw)', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Meta Decks</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '12px', fontWeight: 500, maxWidth: '600px' }}>
            Explore the top-performing S-Tier and A-Tier decks in the current meta.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading database...</div>
      ) : (
        <div className="decks-container">
          {META_DECKS.map((deck) => (
            <DeckItem key={deck.id} deck={deck} resolveDeckCards={resolveDeckCards} />
          ))}
        </div>
      )}
    </div>
  );
};

const DeckItem = ({ deck, resolveDeckCards }) => {
  const carouselRef = useRef(null);
  
  const scroll = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 400 : 250;
      carouselRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const resolvedCards = resolveDeckCards(deck.cards);

  return (
    <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="deck-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{deck.name}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className={`tier-badge ${deck.tier.toLowerCase()}`}>{deck.tier}</span>
            <div className="deck-type-badge" style={{ backgroundColor: `var(--color-${deck.type.toLowerCase()})` }}>
              {deck.type}
            </div>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>{deck.description}</p>
      </div>
      
      <div className="carousel-wrapper" style={{ position: 'relative', padding: '0 50px' }}>
        <button className="apple-carousel-nav left" onClick={() => scroll('left')}>
          <ChevronLeft size={24} />
        </button>
        
        <div className="deck-cards-carousel" ref={carouselRef}>
          {resolvedCards.map((rc, idx) => (
            <PokemonCard key={idx} card={rc.card} count={rc.count} />
          ))}
        </div>

        <button className="apple-carousel-nav right" onClick={() => scroll('right')}>
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

export default MetaDecks;
