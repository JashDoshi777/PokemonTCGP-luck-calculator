import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './AppleSearchBar.css';

const AppleSearchBar = ({ onSelectCard, placeholder = "Search Pokémon..." }) => {
  const { cards } = useAppContext();
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef(null);

  const getRarityDisplay = (r) => {
    if (!r || r === 'All') return null;
    if (r === 'UR') return <img src="/icons/crown.webp" alt="UR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'IM') return <img src="/icons/3star.webp" alt="IM" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'SAR') return <img src="/icons/2star.webp" alt="SAR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'SR') return <img src="/icons/2star.webp" alt="SR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'AR') return <img src="/icons/1star.webp" alt="AR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'SSR') return <img src="/icons/s2.webp" alt="SSR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'S') return <img src="/icons/s1.webp" alt="S" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'RR') return <img src="/icons/4d.webp" alt="RR" style={{ height: '16px', objectFit: 'contain' }} />;
    if (r === 'R') return <div style={{display:'flex', gap:'2px', alignItems:'center'}}>{[...Array(3)].map((_,i) => <img key={i} src="/icons/diamond.png" style={{height:'12px'}}/>)}</div>;
    if (r === 'U') return <div style={{display:'flex', gap:'2px', alignItems:'center'}}>{[...Array(2)].map((_,i) => <img key={i} src="/icons/diamond.png" style={{height:'12px'}}/>)}</div>;
    if (r === 'C') return <img src="/icons/diamond.png" style={{height:'12px'}}/>;
    return <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{r}</span>;
  };

  const results = useMemo(() => {
    if (!query || query.length < 1 || !cards) return [];
    const q = query.toLowerCase();
    
    // Exact startsWith first, then includes
    const starts = cards.filter(c => c.name.toLowerCase().startsWith(q));
    const includes = cards.filter(c => c.name.toLowerCase().includes(q) && !c.name.toLowerCase().startsWith(q));
    
    return [...starts, ...includes];
  }, [query, cards]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (card) => {
    setIsActive(false);
    setQuery('');
    if (onSelectCard) onSelectCard(card);
  };

  return (
    <div className="apple-search-container" ref={containerRef}>
      <div className={`apple-search-input-wrapper ${isActive ? 'active' : ''}`}>
        <Search size={20} className="apple-search-icon" />
        <input 
          type="text"
          className="apple-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsActive(true);
          }}
          onFocus={() => setIsActive(true)}
        />
        {query && (
          <button 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%', color: '#999' }}
            onClick={() => { setQuery(''); setIsActive(false); }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isActive && query && (
        <div className="apple-search-dropdown">
          {results.length > 0 ? (
            results.map((card) => (
              <div 
                key={`${card.set}-${card.number}`} 
                className="search-result-item"
                onClick={() => handleSelect(card)}
              >
                <div className="search-result-info">
                  <span className="search-result-name">{card.name}</span>
                  <span className="search-result-set">{card.set} - {card.number}</span>
                </div>
                <div className="search-result-rarity" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                  {getRarityDisplay(card.rarity)}
                </div>
              </div>
            ))
          ) : (
            <div className="search-no-results">
              No Pokémon found matching "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppleSearchBar;
