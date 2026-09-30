import React, { useState, useEffect } from 'react';
import { isValidAvatar, spriteUrl, artworkUrl } from '../data/avatars';
import './PokemonAvatar.css';

// Round Pokémon avatar. Falls back to the user's initial on a neutral circle
// while there's no avatar yet (first load before the server has answered) or
// if the sprite image can't be fetched.
const PokemonAvatar = ({ avatar, name = '', size = 40, className = '' }) => {
  const valid = isValidAvatar(avatar);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [avatar?.pokemon]);

  const src = valid ? (size >= 48 ? artworkUrl(avatar.pokemon) : spriteUrl(avatar.pokemon)) : null;
  const showImage = valid && !failed;

  return (
    <span
      className={`poke-avatar ${className}`}
      style={{ width: size, height: size, background: valid ? avatar.bg : undefined, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span className="poke-avatar-initial">{(name || '?').charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
};

export default PokemonAvatar;
