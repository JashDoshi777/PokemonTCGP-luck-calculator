import React, { useState, useMemo } from 'react';
import { X, Shuffle } from 'lucide-react';
import PokemonAvatar from './PokemonAvatar';
import { useDialog } from '../hooks/useDialog';
import {
  AVATAR_BACKGROUNDS,
  GENERATIONS,
  generationOf,
  randomAvatar,
  spriteUrl,
} from '../data/avatars';
import './LoginModal.css';
import './AvatarPicker.css';

const AvatarPicker = ({ current, name, onSave, onClose }) => {
  const dialogRef = useDialog(onClose);
  const [pokemon, setPokemon] = useState(current.pokemon);
  const [bg, setBg] = useState(current.bg);
  const [genIndex, setGenIndex] = useState(() => GENERATIONS.indexOf(generationOf(current.pokemon)));

  const generation = GENERATIONS[genIndex];
  const ids = useMemo(
    () => Array.from({ length: generation.to - generation.from + 1 }, (_, i) => generation.from + i),
    [generation]
  );

  const handleRandomize = () => {
    const next = randomAvatar();
    setPokemon(next.pokemon);
    setBg(next.bg);
    setGenIndex(GENERATIONS.indexOf(generationOf(next.pokemon)));
  };

  const unchanged = pokemon === current.pokemon && bg === current.bg;

  return (
    <div className="login-modal-overlay avatar-picker-overlay" data-lenis-prevent onClick={onClose}>
      <div
        className="login-modal-container avatar-picker-container"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose your avatar"
        onClick={e => e.stopPropagation()}
      >
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="avatar-picker-header">
          <PokemonAvatar avatar={{ pokemon, bg }} name={name} size={112} />
          <button type="button" className="avatar-picker-random" onClick={handleRandomize}>
            <Shuffle size={16} /> Randomize
          </button>
        </div>

        <div className="avatar-picker-body">
          <div className="avatar-picker-label">Background</div>
          <div className="avatar-picker-swatches">
            {AVATAR_BACKGROUNDS.map(color => (
              <button
                key={color}
                type="button"
                className={`avatar-picker-swatch ${bg === color ? 'selected' : ''}`}
                aria-pressed={bg === color}
                style={{ background: color }}
                onClick={() => setBg(color)}
                aria-label={`Background ${color}`}
              />
            ))}
          </div>

          <div className="avatar-picker-label">Pokémon</div>
          <div className="avatar-picker-gens">
            {GENERATIONS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                className={`avatar-picker-gen ${i === genIndex ? 'active' : ''}`}
                aria-pressed={i === genIndex}
                onClick={() => setGenIndex(i)}
              >
                Gen {g.label}
              </button>
            ))}
          </div>

          <div className="avatar-picker-grid" data-lenis-prevent>
            {ids.map(id => (
              <button
                key={id}
                type="button"
                className={`avatar-picker-cell ${id === pokemon ? 'selected' : ''}`}
                aria-pressed={id === pokemon}
                onClick={() => setPokemon(id)}
                title={`#${id}`}
                aria-label={`Pokédex #${id}`}
              >
                <img src={spriteUrl(id)} alt="" loading="lazy" width="56" height="56" draggable={false} />
              </button>
            ))}
          </div>

          <div className="avatar-picker-actions">
            <button type="button" className="avatar-picker-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="apple-btn-primary avatar-picker-save"
              disabled={unchanged}
              onClick={() => onSave({ pokemon, bg })}
            >
              Save avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarPicker;
