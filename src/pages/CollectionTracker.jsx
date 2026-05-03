import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import PokemonCard from '../components/PokemonCard';
import AppleSearchBar from '../components/AppleSearchBar';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import './CollectionTracker.css';

const CollectionTracker = () => {
  const { cards, sets, collection, wishlist, toggleWishlist, updateCardCount, loading } = useAppContext();
  const [activeSet, setActiveSet] = useState('A1');
  const [rarityFilter, setRarityFilter] = useState('All');
  const [ownershipFilter, setOwnershipFilter] = useState('All');
  const scrollRef = useRef(null);

  const scrollSets = (direction) => {
    if (scrollRef.current) {
      const amount = window.innerWidth > 768 ? 400 : 200;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  const availableSets = useMemo(() => {
    if (!sets || !cards) return [];
    const setsWithCards = new Set(cards.map(c => c.set));
    const realSets = Object.values(sets)
      .filter(s => setsWithCards.has(s.code))
      .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
      
    return [
      { code: 'WISHLIST', name: { en: 'My Wishlist' } },
      ...realSets
    ];
  }, [sets, cards]);

  const fullSetCards = useMemo(() => {
    if (!cards) return [];
    if (activeSet === 'WISHLIST') {
      return cards.filter(c => wishlist[`${c.set}-${c.number}`]);
    }
    return cards.filter(c => c.set === activeSet);
  }, [cards, activeSet, wishlist]);

  const activeSetCards = useMemo(() => {
    let filtered = fullSetCards;
    if (rarityFilter !== 'All') {
      filtered = filtered.filter(c => c.rarity === rarityFilter);
    }
    if (ownershipFilter === 'Owned') {
      filtered = filtered.filter(c => (collection[`${c.set}-${c.number}`] || 0) > 0);
    } else if (ownershipFilter === 'Missing') {
      filtered = filtered.filter(c => (collection[`${c.set}-${c.number}`] || 0) === 0);
    }
    return filtered;
  }, [fullSetCards, rarityFilter, ownershipFilter, collection]);

  const uniqueRarities = useMemo(() => {
    if (fullSetCards.length === 0) return [];
    const rarities = new Set(fullSetCards.map(c => c.rarity).filter(Boolean));
    const rarityOrder = {
      'C': 1,
      'U': 2,
      'R': 3,
      'RR': 4,
      'AR': 5,
      'SR': 6,
      'SAR': 7,
      'IM': 8,
      'S': 9,
      'SSR': 10,
      'UR': 11
    };
    const sortedRarities = Array.from(rarities).sort((a, b) => {
      const orderA = rarityOrder[a] || 99;
      const orderB = rarityOrder[b] || 99;
      return orderA - orderB;
    });
    return ['All', ...sortedRarities];
  }, [fullSetCards]);

  const setProgress = useMemo(() => {
    if (fullSetCards.length === 0) return 0;
    const ownedInSet = fullSetCards.filter(c => (collection[`${c.set}-${c.number}`] || 0) > 0).length;
    return Math.round((ownedInSet / fullSetCards.length) * 100);
  }, [fullSetCards, collection]);

  const getRarityDisplay = (r) => {
    if (r === 'All') return 'All';
    if (r === 'UR') return <img src="/icons/crown.webp" alt="UR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'IM') return <img src="/icons/3star.webp" alt="IM" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SAR') return <img src="/icons/2star.webp" alt="SAR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SR') return <img src="/icons/2star.webp" alt="SR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'AR') return <img src="/icons/1star.webp" alt="AR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SSR') return <img src="/icons/s2.webp" alt="SSR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'S') return <img src="/icons/s1.webp" alt="S" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'RR') return <img src="/icons/4d.webp" alt="RR" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'R') return <div style={{display:'flex', gap:'2px', alignItems:'center'}}>{[...Array(3)].map((_,i) => <img key={i} src="/icons/diamond.png" style={{height:'14px'}}/>)}</div>;
    if (r === 'U') return <div style={{display:'flex', gap:'2px', alignItems:'center'}}>{[...Array(2)].map((_,i) => <img key={i} src="/icons/diamond.png" style={{height:'14px'}}/>)}</div>;
    if (r === 'C') return <img src="/icons/diamond.png" style={{height:'14px'}}/>;
    return r;
  };

  const handleCardClick = (card) => {
    updateCardCount(`${card.set}-${card.number}`, 1);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading Collection...</div>;

  return (
    <div className="collection-page animate-enter">
      <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="Collection" style={{ width: '80px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Collection Tracker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '8px', fontWeight: 500 }}>
            Track your progress across all expansions.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <AppleSearchBar 
          placeholder="Search any card to add to collection..." 
          onSelectCard={(card) => {
            updateCardCount(`${card.set}-${card.number}`, 1);
            // Optionally change active set to show it
            setActiveSet(card.set);
            setRarityFilter('All');
          }}
        />
      </div>

      <div className="collection-header glass-card">
        <div className="set-selector">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Select Expansion</h3>
          <div className="carousel-wrapper" style={{ position: 'relative', padding: '0 50px' }}>
            <button className="apple-carousel-nav left" onClick={() => scrollSets('left')}>
              <ChevronLeft size={20} />
            </button>
            <div className="set-buttons" ref={scrollRef} style={{ scrollBehavior: 'smooth' }}>
              {availableSets.map(set => (
                <button 
                  key={set.code} 
                  className={`set-btn ${activeSet === set.code ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSet(set.code);
                    setRarityFilter('All');
                  }}
                >
                  {set.name.en} ({set.code})
                </button>
              ))}
            </div>
            <button className="apple-carousel-nav right" onClick={() => scrollSets('right')}>
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '20px' }}>
            {uniqueRarities.length > 1 && (
              <div className="rarity-filters" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                  <Filter size={16} /> Rarity:
                </div>
                {uniqueRarities.map(r => (
                  <button 
                    key={r}
                    className={`rarity-btn ${rarityFilter === r ? 'active' : ''}`}
                    onClick={() => setRarityFilter(r)}
                  >
                    {getRarityDisplay(r)}
                  </button>
                ))}
              </div>
            )}
            
            <div className="apple-segmented-control">
              {['All', 'Owned', 'Missing'].map(f => (
                <button
                  key={f}
                  className={`segmented-btn ${ownershipFilter === f ? 'active' : ''}`}
                  onClick={() => setOwnershipFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="progress-section">
          <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>{activeSet === 'WISHLIST' ? 'Wishlist Progress' : 'Set Completion'}</h3>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${setProgress}%` }}></div>
          </div>
          <p className="progress-text">{setProgress}% Collected</p>
        </div>
      </div>

      <div className="collection-grid">
        {activeSet === 'WISHLIST' && activeSetCards.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>
            Your wishlist is empty. Add cards by clicking the heart icon on any card!
          </div>
        ) : (
          activeSetCards.map((card) => {
            const cardId = `${card.set}-${card.number}`;
            const count = collection[cardId] || 0;
            const isOwned = count > 0;
            return (
              <div 
                key={`${card.set}-${card.number}`} 
                className={`collection-card-wrapper ${isOwned ? 'owned' : 'missing'}`}
                onClick={() => handleCardClick(card)}
              >
                <PokemonCard 
                  card={card} 
                  count={count > 1 ? count : undefined} 
                  isWishlisted={wishlist[cardId]}
                  onToggleWishlist={() => toggleWishlist(cardId)}
                />
                {!isOwned && <div className="missing-overlay">Missing</div>}
                {isOwned && (
                  <button 
                    className="decrement-btn"
                    onClick={(e) => { e.stopPropagation(); updateCardCount(cardId, -1); }}
                    title="Remove one copy"
                  >
                    -
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CollectionTracker;
