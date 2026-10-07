import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { cardImageSources, isResizedSource, reportResizerFailure } from '../utils/cardImage';
import './PokemonCard.css';

const PokemonCard = ({ card, count, isWishlisted, onToggleWishlist }) => {
  const [attempt, setAttempt] = useState(0);   // which image source we are on
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  let cardNumberStr = card.number ? card.number.toString() : '1';
  if (cardNumberStr.includes('/')) {
    cardNumberStr = cardNumberStr.split('/')[0];
  }
  // The new flibustier API does not require zero padding

  const setCode = card.set || 'A1';
  // card.image (from the main card DB) is a bare filename, not a usable URL - only
  // card.artUrl (an explicit full URL some callers supply) should override the default.
  // The previous host (flibustier repo) outgrew jsDelivr's 50 MB limit and now 404s, so art
  // comes from the PocketDecks mirror: lowercase set folder, 3-digit number, promos as pa/pb.
  const setFolder = setCode.toLowerCase().replace(/^promo-/, 'p');
  const imgUrl = card.artUrl || `https://cdn.jsdelivr.net/gh/PocketDecks/pokemon-tcg-pocket-cards@main/images/webp/cards/${setFolder}/${cardNumberStr.padStart(3, '0')}.webp`;
  const sources = useMemo(() => cardImageSources(imgUrl), [imgUrl]);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setImgError(false);
  }, [imgUrl]);

  // An image that was already in the browser cache can finish before React attaches
  // onLoad, so check for that on mount.
  const imgRef = useCallback((node) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const handleError = () => {
    if (isResizedSource(sources[attempt])) reportResizerFailure();
    if (attempt < sources.length - 1) setAttempt(attempt + 1);   // fall back to the original image
    else setImgError(true);
  };

  return (
    <div className="pokemon-card-container">
      <div className={`pokemon-card ${loaded || imgError ? '' : 'is-loading'}`}>
        {imgError ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f5f5f7, #e5e5ea)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1d1d1f', lineHeight: 1.2 }}>{card.name}</span>
            <span style={{ fontSize: '0.85rem', color: '#86868b', marginTop: '6px', fontWeight: 600 }}>{setCode} - {cardNumberStr}</span>
          </div>
        ) : (
          <img
            ref={imgRef}
            className={loaded ? 'is-loaded' : undefined}
            src={sources[attempt]}
            alt={card.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
        )}
        <div className="card-glare"></div>
      </div>
      {count ? <div className="card-count-badge">x{count}</div> : null}
      {onToggleWishlist && (
        <button
          type="button"
          aria-label={isWishlisted ? `Remove ${card.name} from wishlist` : `Add ${card.name} to wishlist`}
          aria-pressed={!!isWishlisted}
          className={`card-wishlist-btn ${isWishlisted ? 'active' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
        >
          <Heart size={16} fill={isWishlisted ? "#ff3b30" : "none"} color={isWishlisted ? "#ff3b30" : "white"} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default PokemonCard;
