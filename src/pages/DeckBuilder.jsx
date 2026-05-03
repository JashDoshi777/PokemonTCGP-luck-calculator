import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import PokemonCard from '../components/PokemonCard';
import { Search, Save, Trash2, ArrowLeft, FolderOpen } from 'lucide-react';
import './DeckBuilder.css';

const MAX_DECK_SIZE = 20;
const MAX_CARD_COPIES = 2;

const DeckBuilder = ({ onRequestLogin }) => {
  const { user, cards, loading, saveDeck, customDecks } = useAppContext();
  const [mode, setMode] = useState('builder');
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deck, setDeck] = useState([]);
  const [deckName, setDeckName] = useState('My Custom Deck');

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    if (!searchQuery) return cards.slice(0, 100);
    return cards.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 100);
  }, [cards, searchQuery]);

  const addCardToDeck = (card) => {
    if (deck.length >= MAX_DECK_SIZE) {
      alert('Deck is already full (20 cards maximum).');
      return;
    }
    const countInDeck = deck.filter(c => c.name === card.name).length;
    if (countInDeck >= MAX_CARD_COPIES) {
      alert(`You can only have ${MAX_CARD_COPIES} copies of ${card.name}.`);
      return;
    }
    setDeck([...deck, card]);
  };

  const removeCardFromDeck = (indexToRemove) => {
    setDeck(deck.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = () => {
    if (!user) {
      onRequestLogin();
      return;
    }
    if (deck.length !== MAX_DECK_SIZE) {
      alert(`A valid deck must contain exactly ${MAX_DECK_SIZE} cards.`);
      return;
    }
    if (!deckName.trim()) {
      alert('Please enter a deck name.');
      return;
    }
    saveDeck({
      name: deckName,
      cards: deck,
      type: 'Custom'
    });
    alert('Deck saved successfully!');
    setMode('saved');
    setDeck([]);
    setDeckName('My Custom Deck');
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear your deck?')) {
      setDeck([]);
    }
  };

  const getDeckCardCounts = (deckCards) => {
    const counts = {};
    (deckCards || []).forEach(c => {
      const key = `${c.set}-${c.number}`;
      if (!counts[key]) counts[key] = { card: c, count: 0 };
      counts[key].count++;
    });
    return Object.values(counts);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading database...</div>;

  return (
    <div className="deck-builder-page animate-enter">
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <img src="/images/pocket_logo.webp" alt="Deck Builder" style={{ width: '60px', borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' }} />
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Deck Builder</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '4px', fontWeight: 500 }}>
              Construct your ultimate 20-card deck and save it to the cloud.
            </p>
          </div>
        </div>
        
        <div className="apple-segmented-control" style={{ marginTop: '0' }}>
          <button className={`segmented-btn ${mode === 'builder' ? 'active' : ''}`} onClick={() => { setMode('builder'); setSelectedDeck(null); }}>
            Builder
          </button>
          <button className={`segmented-btn ${mode === 'saved' ? 'active' : ''}`} onClick={() => setMode('saved')}>
            My Decks
          </button>
        </div>
      </div>

      {mode === 'builder' ? (
        <div className="db-layout">
          <div className="catalog-pane glass-card">
            <div className="pane-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Card Catalog</h3>
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search cards..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="catalog-grid" data-lenis-prevent="true">
              {filteredCards.map((card) => (
                <div key={`${card.set}-${card.number}`} onClick={() => addCardToDeck(card)} className="catalog-card-wrapper">
                  <PokemonCard card={card} />
                  <div className="add-overlay">+</div>
                </div>
              ))}
            </div>
          </div>

          <div className="deck-pane glass-card">
            <div className="pane-header" style={{ marginBottom: '15px' }}>
              <input 
                type="text" 
                className="deck-name-input"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Enter deck name..."
              />
              <div className="deck-stats">
                <span className={`count-badge ${deck.length === MAX_DECK_SIZE ? 'complete' : ''}`}>
                  {deck.length} / {MAX_DECK_SIZE}
                </span>
              </div>
            </div>
            
            <div className="deck-actions">
              <button className="btn-super" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSave}>
                <Save size={16} /> Save Deck
              </button>
              <button className="btn-super" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)' }} onClick={handleClear}>
                <Trash2 size={16} /> Clear
              </button>
            </div>

            <div className="active-deck-grid" data-lenis-prevent="true">
              {Array.from({ length: MAX_DECK_SIZE }).map((_, idx) => {
                const card = deck[idx];
                return (
                  <div key={idx} className="deck-slot" onClick={() => card && removeCardFromDeck(idx)}>
                    {card ? (
                      <>
                        <PokemonCard card={card} />
                        <div className="remove-overlay">-</div>
                      </>
                    ) : (
                      <div className="empty-slot">{idx + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="saved-decks-layout glass-card" style={{ padding: '30px', minHeight: '600px' }}>
          {selectedDeck ? (
            <div className="animate-enter">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <button className="btn-super" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)' }} onClick={() => setSelectedDeck(null)}>
                  <ArrowLeft size={18} /> Back to My Decks
                </button>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{selectedDeck.name}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{selectedDeck.cards.length} Cards</p>
                </div>
              </div>
              <div className="saved-deck-detail-grid">
                {getDeckCardCounts(selectedDeck.cards).map((item, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <PokemonCard card={item.card} />
                    {item.count > 1 && (
                      <div className="card-count-badge">x{item.count}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>My Saved Decks</h3>
              {(!Array.isArray(customDecks) || customDecks.filter(Boolean).length === 0) ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                  <FolderOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>No decks saved yet.</p>
                  <p>Build a deck in the Builder tab and save it to see it here.</p>
                </div>
              ) : (
                <div className="saved-decks-grid">
                  {(Array.isArray(customDecks) ? customDecks : []).filter(Boolean).map(d => (
                    <div key={d.id || Math.random()} className="saved-deck-card" onClick={() => setSelectedDeck(d)}>
                      <div className="deck-card-preview">
                        {(Array.isArray(d.cards) ? d.cards : []).filter(Boolean).slice(0, 3).map((c, i) => (
                          <div key={i} className="preview-card" style={{ zIndex: 3 - i, transform: `translateX(${i * 20}px)` }}>
                            <PokemonCard card={c} />
                          </div>
                        ))}
                      </div>
                      <div className="deck-card-info">
                        <h4>{d.name || 'Untitled Deck'}</h4>
                        <p>{(d.cards || []).length} Cards</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeckBuilder;
