// Pokémon avatars. An avatar is just { pokemon: <Pokédex number>, bg: <tint> } -
// the same "seed + background" idea as DiceBear, but rendered as a Pokémon
// sprite (DiceBear has no Pokémon style). The palette and id range mirror
// AVATAR_BACKGROUNDS / MAX_POKEMON_ID in netlify/functions/api.js.

export const MAX_POKEMON_ID = 1025;

export const AVATAR_BACKGROUNDS = [
  '#FFD9D9', '#FFE8CC', '#FFF3BF', '#DDF3D6',
  '#D3F0F5', '#D9E4FF', '#E6DCFF', '#FFD9EC',
];

export const GENERATIONS = [
  { label: 'I', from: 1, to: 151 },
  { label: 'II', from: 152, to: 251 },
  { label: 'III', from: 252, to: 386 },
  { label: 'IV', from: 387, to: 493 },
  { label: 'V', from: 494, to: 649 },
  { label: 'VI', from: 650, to: 721 },
  { label: 'VII', from: 722, to: 809 },
  { label: 'VIII', from: 810, to: 905 },
  { label: 'IX', from: 906, to: 1025 },
];

// PokeAPI's sprite repo, served through jsDelivr (raw.githubusercontent.com
// throttles when many images load at once).
const SPRITE_CDN = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon';

// Tiny (~600 B) 96px sprite - used for small avatars and the picker grid.
export const spriteUrl = (id) => `${SPRITE_CDN}/${id}.png`;

// Large official artwork - only worth loading for big avatars.
export const artworkUrl = (id) => `${SPRITE_CDN}/other/official-artwork/${id}.png`;

export function generationOf(id) {
  return GENERATIONS.find(g => id >= g.from && id <= g.to) || GENERATIONS[0];
}

export function randomAvatar() {
  return {
    pokemon: 1 + Math.floor(Math.random() * MAX_POKEMON_ID),
    bg: AVATAR_BACKGROUNDS[Math.floor(Math.random() * AVATAR_BACKGROUNDS.length)],
  };
}

export function isValidAvatar(avatar) {
  return !!avatar &&
    Number.isInteger(avatar.pokemon) && avatar.pokemon >= 1 && avatar.pokemon <= MAX_POKEMON_ID &&
    typeof avatar.bg === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatar.bg);
}
