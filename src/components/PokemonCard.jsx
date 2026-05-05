import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import './PokemonCard.css';

const PokemonCard = ({ card, count, isWishlisted, onToggleWishlist }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [card]);

  let cardNumberStr = card.number ? card.number.toString() : '1';
  if (cardNumberStr.includes('/')) {
    cardNumberStr = cardNumberStr.split('/')[0];
  }
  // The new flibustier API does not require zero padding
  
  const setCode = card.set || 'A1';
  const imgUrl = `https://cdn.jsdelivr.net/gh/flibustier/pokemon-tcg-exchange@main/public/images/cards-by-set/${setCode}/${cardNumberStr}.webp`;

  return (
    <div className="pokemon-card-container">
      <div className="pokemon-card">
        {imgError ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f5f5f7, #e5e5ea)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1d1d1f', lineHeight: 1.2 }}>{card.name}</span>
            <span style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '6px', fontWeight: 600 }}>{setCode} - {cardNumberStr}</span>
          </div>
        ) : (
          <img 
            src={imgUrl} 
            alt={card.name} 
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
        <div className="card-glare"></div>
      </div>
      {count && (
        <div className="card-count-badge">x{count}</div>
      )}
      {onToggleWishlist && (
        <button 
          className={`card-wishlist-btn ${isWishlisted ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
        >
          <Heart size={16} fill={isWishlisted ? "#ff3b30" : "none"} color={isWishlisted ? "#ff3b30" : "white"} />
        </button>
      )}
    </div>
  );
};

export default PokemonCard;
