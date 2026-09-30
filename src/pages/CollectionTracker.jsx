import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import PokemonCard from '../components/PokemonCard';
import { ChevronLeft, ChevronRight, Filter, CheckCircle2, Sparkles, Hand, MousePointer2, Search, X } from 'lucide-react';
import { getEnergyMap, staticEnergyMapping } from '../services/EnergyMapService';
import '../components/AppleSearchBar.css'; // styles for the search field used below
import './CollectionTracker.css';

const AppleProgressRing = ({ percentage, size = 100, stroke  = 8 }) => {
  const radius = size / 2;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg height={size} width={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          stroke="rgba(150, 150, 160, 0.2)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="url(#progress-gradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34c759" />
            <stop offset="100%" stopColor="#30d158" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
        fontWeight: 800, fontSize: `${size * 0.22}px`, color: 'var(--text-main)' 
      }}>
        {percentage}%
      </div>
    </div>
  );
};

const CARDS_PER_BATCH = 60;

const CollectionTracker = () => {
  const { cards, sets, collection, wishlist, toggleWishlist, updateCardCount, batchUpdateCollection, loading } = useAppContext();
  const [activeSet, setActiveSet] = useState('A1');
  const [rarityFilter, setRarityFilter] = useState('All');
  const [energyFilters, setEnergyFilters] = useState([]);
  const [energyMapping, setEnergyMapping] = useState(staticEnergyMapping);
  const [ownershipFilter, setOwnershipFilter] = useState('All');
  const [isDragging, setIsDragging] = useState(false);
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const scrollRef = useRef(null);
  const draggedCardsRef = useRef(new Set());
  // True between a pointer press that already counted and the click that follows
  // it, so one physical press never adds two copies.
  const pressHandledRef = useRef(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getEnergyMap().then(map => { if (!cancelled) setEnergyMapping(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const toggleEnergyFilter = (type) => {
    if (type === 'All') {
      setEnergyFilters([]);
      return;
    }
    setEnergyFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
      draggedCardsRef.current.clear();
      // The click for this press (if any) is dispatched right after mouseup; clear the flag once it has had its chance.
      setTimeout(() => { pressHandledRef.current = false; }, 0);
    };
    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('touchend', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('touchend', handleMouseUpGlobal);
    };
  }, []);

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
    let filtered = cards || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
    } else {
      filtered = fullSetCards;
    }
    if (rarityFilter !== 'All') {
      filtered = filtered.filter(c => c.rarity === rarityFilter);
    }
    if (energyFilters.length > 0) {
      filtered = filtered.filter(c => energyFilters.includes(energyMapping[c.name]));
    }
    if (ownershipFilter === 'Owned') {
      filtered = filtered.filter(c => (collection[`${c.set}-${c.number}`] || 0) > 0);
    } else if (ownershipFilter === 'Missing') {
      filtered = filtered.filter(c => (collection[`${c.set}-${c.number}`] || 0) === 0);
    }
    return filtered;
  }, [cards, fullSetCards, rarityFilter, energyFilters, energyMapping, ownershipFilter, collection, searchQuery]);

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



  // Only part of a big set is drawn at first; more cards load as you scroll. Changing
  // the set or any filter starts over from the first batch.
  const filterKey = [activeSet, rarityFilter, energyFilters.join(','), ownershipFilter, searchQuery].join('|');
  const [batch, setBatch] = useState({ key: filterKey, count: CARDS_PER_BATCH });
  const visibleCount = batch.key === filterKey ? batch.count : CARDS_PER_BATCH;
  const visibleCards = activeSetCards.slice(0, visibleCount);
  const hasMore = visibleCount < activeSetCards.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setBatch({ key: filterKey, count: visibleCount + CARDS_PER_BATCH });
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, filterKey]);

  const getRarityDisplay = (r) => {
    if (r === 'All') return 'All';
    if (r === 'UR') return <img src="/icons/crown.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'IM') return <img src="/icons/3star.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SAR') return <img src="/icons/2star.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SR') return <img src="/icons/2star.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'AR') return <img src="/icons/1star.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'SSR') return <img src="/icons/s2.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'S') return <img src="/icons/s1.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'RR') return <img src="/icons/4d.webp" alt="" style={{ height: '18px', objectFit: 'contain' }} />;
    if (r === 'R') return <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>{[...Array(3)].map((_, i) => <img key={i} src="/icons/diamond.png" alt="" style={{ height: '14px' }} />)}</div>;
    if (r === 'U') return <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>{[...Array(2)].map((_, i) => <img key={i} src="/icons/diamond.png" alt="" style={{ height: '14px' }} />)}</div>;
    if (r === 'C') return <img src="/icons/diamond.png" alt="" style={{ height: '14px' }} />;
    return r;
  };

  const handleCardClick = (card) => {
    updateCardCount(`${card.set}-${card.number}`, 1);
  };

  const allVisibleOwned = useMemo(() => {
    if (activeSetCards.length === 0) return false;
    return activeSetCards.every(c => (collection[`${c.set}-${c.number}`] || 0) > 0);
  }, [activeSetCards, collection]);

  const handleSelectAll = () => {
    if (activeSetCards.length === 0) return;
    const cardIds = activeSetCards.map(c => `${c.set}-${c.number}`);
    if (allVisibleOwned) {
      batchUpdateCollection(cardIds, -1);
    } else {
      batchUpdateCollection(cardIds, 1);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading Collection...</div>;

  return (
    <div className="collection-page animate-enter">
      <div className="glass-panel" style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <img src="/images/pocket_logo.webp" alt="Collection" style={{ width: '80px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Collection Tracker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '8px', fontWeight: 500 }}>
            Track your progress across all expansions. Drag across cards to quickly add them!
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <div className="apple-search-container">
          <div className={`apple-search-input-wrapper ${isSearchActive || searchQuery ? 'active' : ''}`}>
            <Search size={20} className="apple-search-icon" />
            <input 
              type="text"
              className="apple-search-input"
              placeholder="Search any card across all expansions..."
              aria-label="Search any card across all expansions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchActive(true)}
              onBlur={() => setIsSearchActive(false)}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%', color: '#999' }}
                onClick={() => setSearchQuery('')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>



      <div className="collection-header glass-card">
        <div className="set-selector">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Select Expansion</h3>
          <div className="carousel-wrapper" style={{ position: 'relative', padding: '0 50px' }}>
            <button className="apple-carousel-nav left" onClick={() => scrollSets('left')} aria-label="Scroll expansions left">
              <ChevronLeft size={20} />
            </button>
            <div className="set-buttons" ref={scrollRef} style={{ scrollBehavior: 'smooth' }}>
              {availableSets.map(set => (
                <button
                  key={set.code}
                  className={`set-btn ${activeSet === set.code ? 'active' : ''}`}
                  aria-pressed={activeSet === set.code}
                  onClick={() => {
                    setActiveSet(set.code);
                    setRarityFilter('All');
                    setEnergyFilters([]);
                  }}
                >
                  {set.name.en} ({set.code})
                </button>
              ))}
            </div>
            <button className="apple-carousel-nav right" onClick={() => scrollSets('right')} aria-label="Scroll expansions right">
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '20px' }}>
            {uniqueRarities.length > 1 && (
              <div className="rarity-filters" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                  <Filter size={16} /> Rarity:
                </div>
                {uniqueRarities.map(r => (
                  <button
                    key={r}
                    className={`rarity-btn ${rarityFilter === r ? 'active' : ''}`}
                    aria-pressed={rarityFilter === r}
                    aria-label={r === 'All' ? 'All rarities' : `Rarity ${r}`}
                    onClick={() => setRarityFilter(r)}
                  >
                    {getRarityDisplay(r)}
                  </button>
                ))}
              </div>
            )}
            
            <div className="energy-filters" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginRight: '10px' }}>
                Energy:
              </div>
              {['All', 'Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Colorless', 'Fairy', 'Dragon'].map(type => {
                const isActive = type === 'All' ? energyFilters.length === 0 : energyFilters.includes(type);
                return (
                <button
                  key={type}
                  className={`energy-btn ${isActive ? 'active' : ''}`}
                  aria-pressed={isActive}
                  aria-label={type === 'All' ? 'All energy types' : `${type} energy`}
                  onClick={() => toggleEnergyFilter(type)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: type === 'All' ? 'auto' : '38px',
                    height: type === 'All' ? 'auto' : '38px',
                    padding: type === 'All' ? '6px 16px' : '0',
                    borderRadius: type === 'All' ? '20px' : '50%',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: type === 'All'
                      ? `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)'}`
                      : 'none',
                    boxShadow: isActive && type !== 'All' ? '0 0 0 2px rgba(255,255,255,0.8), 0 6px 16px rgba(0,0,0,0.3)' : 'none',
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', fontWeight: 600, fontSize: '0.95rem',
                    opacity: energyFilters.length > 0 && !isActive ? 0.4 : 1,
                    transform: isActive && type !== 'All' ? 'scale(1.2)' : 'scale(1)'
                  }}
                  title={type}
                >
                  {type === 'All' ? 'All' : <img src={`/icons/energy_${type}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />}
                </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className={`select-all-btn paint-mode-toggle ${isPaintMode ? 'active' : ''}`}
                onClick={() => setIsPaintMode(!isPaintMode)}
                aria-pressed={isPaintMode}
                title={isPaintMode ? "Disable Paint Mode" : "Enable Paint Mode"}
                style={{ background: isPaintMode ? 'rgba(52, 199, 89, 0.15)' : '', color: isPaintMode ? '#34c759' : '' }}
              >
                {isPaintMode ? <Hand size={16} /> : <MousePointer2 size={16} />} 
                {isPaintMode ? 'Paint Mode: ON' : 'Paint Mode: OFF'}
              </button>
              <div className="apple-segmented-control">
                {['All', 'Owned', 'Missing'].map(f => (
                  <button
                    key={f}
                    className={`segmented-btn ${ownershipFilter === f ? 'active' : ''}`}
                    aria-pressed={ownershipFilter === f}
                    onClick={() => setOwnershipFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                className={`select-all-btn ${allVisibleOwned ? 'active' : ''}`}
                onClick={handleSelectAll}
                title={allVisibleOwned ? "Deselect all visible cards" : "Select all visible cards"}
              >
                <CheckCircle2 size={16} /> {allVisibleOwned ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
        </div>

        <div className="progress-section" style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px', background: 'rgba(0,0,0,0.02)', borderRadius: '24px', marginTop: '24px' }}>
          <AppleProgressRing percentage={setProgress} size={90} stroke={8} />
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>{activeSet === 'WISHLIST' ? 'Wishlist Progress' : 'Set Completion'}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
              You have collected {setProgress}% of {activeSet === 'WISHLIST' ? 'your wishlist' : 'this expansion'}.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`collection-grid ${isPaintMode ? 'paint-mode-active' : ''}`}
        onMouseLeave={() => setIsDragging(false)}
        style={{ touchAction: isPaintMode ? 'none' : 'auto' }}
      >
        {activeSetCards.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>
            {searchQuery
              ? `No cards found matching "${searchQuery}"`
              : activeSet === 'WISHLIST'
                ? "Your wishlist is empty. Add cards by clicking the heart icon on any card!"
                : "No cards found in this selection."
            }
          </div>
        ) : (
          visibleCards.map((card) => {
            const cardId = `${card.set}-${card.number}`;
            const count = collection[cardId] || 0;
            const isOwned = count > 0;
            return (
              <div
                key={cardId}
                id={`card-${cardId}`}
                className={`collection-card-wrapper ${isOwned ? 'owned' : 'missing'}`}
                role="group"
                tabIndex={0}
                aria-label={`${card.name}, ${isOwned ? `${count} owned` : 'missing'}. Press Enter to add a copy or Backspace to remove one.`}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return; // keys pressed on the inner buttons are theirs
                  if (e.key === 'Enter' || e.key === ' ' || e.key === '+') {
                    e.preventDefault();
                    handleCardClick(card);
                  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') {
                    e.preventDefault();
                    updateCardCount(cardId, -1);
                  }
                }}
                onPointerDown={(e) => {
                  // Only the primary button counts - right / middle clicks must not add cards.
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  // A plain touch tap is handled by onClick; touch only acts here while painting.
                  if (e.pointerType === 'touch' && !isPaintMode) return;
                  e.preventDefault();
                  pressHandledRef.current = true;
                  setIsDragging(true);
                  draggedCardsRef.current.clear();
                  draggedCardsRef.current.add(cardId);
                  handleCardClick(card);
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (isDragging && e.buttons === 1 && !draggedCardsRef.current.has(cardId)) {
                    draggedCardsRef.current.add(cardId);
                    handleCardClick(card);
                  }
                }}
                onTouchMove={(e) => {
                  if (!isPaintMode) return;
                  e.preventDefault();
                  const touch = e.touches[0];
                  const element = document.elementFromPoint(touch.clientX, touch.clientY);
                  const wrapper = element?.closest('.collection-card-wrapper');
                  if (!wrapper?.id) return;
                  // wrapper ids look like "card-<set>-<number>"; split on the LAST hyphen since
                  // some set codes (e.g. promo sets) contain hyphens themselves.
                  const targetId = wrapper.id.replace('card-', '');
                  if (targetId.lastIndexOf('-') > 0 && !draggedCardsRef.current.has(targetId)) {
                    draggedCardsRef.current.add(targetId);
                    updateCardCount(targetId, 1);
                  }
                }}
                onClick={() => {
                  // The press that started this click already added a copy.
                  if (pressHandledRef.current) {
                    pressHandledRef.current = false;
                    return;
                  }
                  handleCardClick(card);
                }}
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
                    type="button"
                    className="decrement-btn"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking decrement
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); updateCardCount(cardId, -1); }}
                    title="Remove one copy"
                    aria-label={`Remove one copy of ${card.name}`}
                  >
                    -
                  </button>
                )}
              </div>
            );
          })
        )}
        {hasMore && (
          <div ref={sentinelRef} className="collection-more">
            <button type="button" onClick={() => setBatch({ key: filterKey, count: visibleCount + CARDS_PER_BATCH })}>
              Show more cards ({activeSetCards.length - visibleCount} left)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionTracker;
