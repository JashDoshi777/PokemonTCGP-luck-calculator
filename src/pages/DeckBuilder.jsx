import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import PokemonCard from '../components/PokemonCard';
import { Search, Save, Trash2, ArrowLeft, FolderOpen, Download, Pencil } from 'lucide-react';
import './DeckBuilder.css';

const MAX_DECK_SIZE = 20;
const MAX_CARD_COPIES = 2;
const CATALOG_LIMIT = 100;
const DEFAULT_DECK_NAME = 'My Custom Deck';
const CONFIRM_WINDOW_MS = 4000;

const DeckBuilder = ({ onRequestLogin }) => {
  const { user, cards, loading, saveDeck, deleteDeck, customDecks, getCard } = useAppContext();
  const [mode, setMode] = useState('builder');
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deck, setDeck] = useState([]);
  const [deckName, setDeckName] = useState(DEFAULT_DECK_NAME);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text }
  const [confirming, setConfirming] = useState(null); // 'clear' | `delete:${id}`
  const deckRef = useRef(null);
  const confirmTimer = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  // Saved decks keep only { set, number } references; look up the full card data for display.
  const hydrate = useCallback(
    (savedDeck) => (savedDeck?.cards || []).map(c => getCard(c.set, c.number)).filter(Boolean),
    [getCard]
  );

  const savedDecks = useMemo(() => (Array.isArray(customDecks) ? customDecks : []), [customDecks]);
  const selectedDeck = savedDecks.find(d => d.id === selectedDeckId) || null;
  const selectedCards = useMemo(() => hydrate(selectedDeck), [hydrate, selectedDeck]);

  const query = searchQuery.trim().toLowerCase();
  const matchingCards = useMemo(() => {
    if (!cards) return [];
    return query ? cards.filter(c => c.name.toLowerCase().includes(query)) : cards;
  }, [cards, query]);
  const filteredCards = matchingCards.slice(0, CATALOG_LIMIT);

  const notify = (type, text) => setStatus({ type, text });

  // Destructive actions ask twice: the first press arms the button, the second confirms.
  const confirmOnSecondPress = (key, action) => {
    if (confirming === key) {
      clearTimeout(confirmTimer.current);
      setConfirming(null);
      action();
      return;
    }
    setConfirming(key);
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirming(null), CONFIRM_WINDOW_MS);
  };

  const addCardToDeck = (card) => {
    if (deck.length >= MAX_DECK_SIZE) {
      notify('error', `Your deck is full (${MAX_DECK_SIZE} cards maximum).`);
      return;
    }
    const countInDeck = deck.filter(c => c.name === card.name).length;
    if (countInDeck >= MAX_CARD_COPIES) {
      notify('error', `You can only have ${MAX_CARD_COPIES} copies of ${card.name}.`);
      return;
    }
    setStatus(null);
    setDeck([...deck, card]);
  };

  const removeCardFromDeck = (indexToRemove) => {
    setDeck(deck.filter((_, idx) => idx !== indexToRemove));
  };

  const exportDeckAsImage = async (name) => {
    const node = deckRef.current;
    if (!node) return;
    let clone;
    try {
      // html2canvas is large, so it is only fetched when someone actually exports.
      const { default: html2canvas } = await import('html2canvas');
      const isDark = document.body.classList.contains('dark-mode');

      // Clone the element to break out of flexbox/height constraints
      clone = node.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.height = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.width = node.offsetWidth + 'px';

      const grid = clone.querySelector('.active-deck-grid');
      if (grid) {
        grid.style.overflowY = 'visible';
        grid.style.maxHeight = 'none';
        grid.style.height = 'auto';
      }

      document.body.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 100)); // let the browser paint the clone

      const canvas = await html2canvas(clone, {
        backgroundColor: isDark ? '#1c1c1e' : '#f0f0f5',
        scale: 2,
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      link.download = `${(name || 'Pokemon_Deck').replace(/[^\w.-]+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export deck image', err);
      notify('error', "Couldn't create the image. Please try again.");
    } finally {
      clone?.remove();
    }
  };

  const handleSave = () => {
    if (!user) {
      onRequestLogin();
      return;
    }
    if (deck.length !== MAX_DECK_SIZE) {
      notify('error', `A valid deck must contain exactly ${MAX_DECK_SIZE} cards (you have ${deck.length}).`);
      return;
    }
    const name = deckName.trim();
    if (!name) {
      notify('error', 'Please give your deck a name.');
      return;
    }
    saveDeck({
      id: editingId || undefined,
      name,
      cards: deck.map(({ set, number }) => ({ set, number })),
      type: 'Custom'
    });
    notify('success', editingId ? 'Deck updated.' : 'Deck saved to your account.');
    setSelectedDeckId(null);
    setMode('saved');
    setDeck([]);
    setDeckName(DEFAULT_DECK_NAME);
    setEditingId(null);
  };

  const handleClear = () => {
    setDeck([]);
    setStatus(null);
  };

  const startEditing = (savedDeck) => {
    setDeck(hydrate(savedDeck));
    setDeckName(savedDeck.name || DEFAULT_DECK_NAME);
    setEditingId(savedDeck.id);
    setStatus(null);
    setMode('builder');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDeck([]);
    setDeckName(DEFAULT_DECK_NAME);
    setStatus(null);
  };

  const handleDelete = (savedDeck) => {
    deleteDeck(savedDeck.id);
    if (editingId === savedDeck.id) cancelEditing();
    setSelectedDeckId(null);
    notify('success', `"${savedDeck.name || 'Deck'}" deleted.`);
  };

  const getDeckCardCounts = (deckCards) => {
    const counts = {};
    deckCards.forEach(c => {
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
          <img src="/images/pocket_logo.webp" alt="" style={{ width: '60px', borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' }} />
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gradient">Deck Builder</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '4px', fontWeight: 500 }}>
              Construct your ultimate 20-card deck and save it to the cloud.
            </p>
          </div>
        </div>

        <div className="apple-segmented-control" role="tablist" aria-label="Deck builder views" style={{ marginTop: '0' }}>
          <button role="tab" aria-selected={mode === 'builder'} className={`segmented-btn ${mode === 'builder' ? 'active' : ''}`} onClick={() => { setMode('builder'); setSelectedDeckId(null); }}>
            Builder
          </button>
          <button role="tab" aria-selected={mode === 'saved'} className={`segmented-btn ${mode === 'saved' ? 'active' : ''}`} onClick={() => setMode('saved')}>
            My Decks
          </button>
        </div>
      </div>

      {status && (
        <div className={`deck-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
          {status.text}
        </div>
      )}

      {mode === 'builder' ? (
        <div className="db-layout">
          <div className="catalog-pane glass-card">
            <div className="pane-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Card Catalog</h3>
              <div className="search-box">
                <Search size={16} className="search-icon" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search cards..."
                  aria-label="Search cards"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="catalog-grid" data-lenis-prevent="true">
              {filteredCards.map((card) => (
                <button
                  type="button"
                  key={`${card.set}-${card.number}`}
                  onClick={() => addCardToDeck(card)}
                  className="catalog-card-wrapper"
                  aria-label={`Add ${card.name} to deck`}
                >
                  <PokemonCard card={card} />
                  <div className="add-overlay" aria-hidden="true">+</div>
                </button>
              ))}
              {filteredCards.length === 0 && (
                <div className="catalog-empty">No cards match “{searchQuery}”.</div>
              )}
              {matchingCards.length > CATALOG_LIMIT && (
                <div className="catalog-empty">
                  Showing the first {CATALOG_LIMIT} of {matchingCards.length.toLocaleString()} cards — search to narrow it down.
                </div>
              )}
            </div>
          </div>

          <div className="deck-pane glass-card" ref={deckRef} style={{ padding: '30px' }}>
            <div className="pane-header" style={{ marginBottom: '15px' }}>
              <input
                type="text"
                className="deck-name-input"
                value={deckName}
                maxLength={60}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Enter deck name..."
                aria-label="Deck name"
              />
              <div className="deck-stats">
                <span className={`count-badge ${deck.length === MAX_DECK_SIZE ? 'complete' : ''}`} aria-live="polite">
                  {deck.length} / {MAX_DECK_SIZE}
                </span>
              </div>
            </div>

            {editingId && (
              <div className="deck-editing-note" data-html2canvas-ignore="true">
                Editing a saved deck.
                <button type="button" onClick={cancelEditing}>Cancel</button>
              </div>
            )}

            <div className="deck-actions" data-html2canvas-ignore="true">
              <button className="btn-super" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSave}>
                <Save size={16} aria-hidden="true" /> {editingId ? 'Save Changes' : 'Save Deck'}
              </button>
              <button className="btn-super" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)' }} onClick={() => exportDeckAsImage(deckName)}>
                <Download size={16} aria-hidden="true" /> Export
              </button>
              <button
                className="btn-super"
                style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', background: confirming === 'clear' ? '#ff3b30' : 'rgba(255,59,48,0.1)', color: confirming === 'clear' ? '#fff' : '#ff3b30' }}
                onClick={() => (deck.length > 0 ? confirmOnSecondPress('clear', handleClear) : undefined)}
              >
                <Trash2 size={16} aria-hidden="true" /> {confirming === 'clear' ? 'Tap again to clear' : 'Clear'}
              </button>
            </div>

            <div className="active-deck-grid" data-lenis-prevent="true">
              {Array.from({ length: MAX_DECK_SIZE }).map((_, idx) => {
                const card = deck[idx];
                return card ? (
                  <button type="button" key={idx} className="deck-slot" onClick={() => removeCardFromDeck(idx)} aria-label={`Remove ${card.name} from deck`}>
                    <PokemonCard card={card} />
                    <div className="remove-overlay" aria-hidden="true">-</div>
                  </button>
                ) : (
                  <div key={idx} className="deck-slot">
                    <div className="empty-slot">{idx + 1}</div>
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
              <div className="saved-deck-head">
                <button className="btn-super" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)' }} onClick={() => setSelectedDeckId(null)}>
                  <ArrowLeft size={18} aria-hidden="true" /> Back to My Decks
                </button>
                <div className="saved-deck-title">
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, overflowWrap: 'anywhere' }}>{selectedDeck.name}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{selectedCards.length} Cards</p>
                </div>
              </div>
              <div className="saved-deck-actions">
                <button type="button" className="btn-super" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => startEditing(selectedDeck)}>
                  <Pencil size={16} aria-hidden="true" /> Edit deck
                </button>
                <button
                  type="button"
                  className="btn-super"
                  style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', background: confirming === `delete:${selectedDeck.id}` ? '#ff3b30' : 'rgba(255,59,48,0.1)', color: confirming === `delete:${selectedDeck.id}` ? '#fff' : '#ff3b30' }}
                  onClick={() => confirmOnSecondPress(`delete:${selectedDeck.id}`, () => handleDelete(selectedDeck))}
                >
                  <Trash2 size={16} aria-hidden="true" /> {confirming === `delete:${selectedDeck.id}` ? 'Tap again to delete' : 'Delete'}
                </button>
              </div>
              {selectedCards.length < (selectedDeck.cards || []).length && (
                <p className="catalog-empty">Some cards in this deck are no longer in the card database and can't be shown.</p>
              )}
              <div className="saved-deck-detail-grid">
                {getDeckCardCounts(selectedCards).map((item) => (
                  <div key={`${item.card.set}-${item.card.number}`} style={{ position: 'relative' }}>
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
              {savedDecks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                  <FolderOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} aria-hidden="true" />
                  <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>No decks saved yet.</p>
                  <p>Build a deck in the Builder tab and save it to see it here.</p>
                </div>
              ) : (
                <div className="saved-decks-grid">
                  {savedDecks.map(d => {
                    const previewCards = hydrate(d).slice(0, 3);
                    return (
                      <button type="button" key={d.id} className="saved-deck-card" onClick={() => setSelectedDeckId(d.id)} aria-label={`Open deck ${d.name || 'Untitled Deck'}`}>
                        <div className="deck-card-preview">
                          {previewCards.map((c, i) => (
                            <div key={`${c.set}-${c.number}`} className="preview-card" style={{ zIndex: 3 - i, transform: `translateX(${i * 20}px)` }}>
                              <PokemonCard card={c} />
                            </div>
                          ))}
                        </div>
                        <div className="deck-card-info">
                          <h4>{d.name || 'Untitled Deck'}</h4>
                          <p>{(d.cards || []).length} Cards</p>
                        </div>
                      </button>
                    );
                  })}
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
