import { useState } from 'react';
import { packArtCandidates } from '../services/PacksService';

// Renders a pack's box art, falling back through auto-fetched candidates
// (community box art -> set logo) and finally a plain text tile if a set
// isn't covered by any source yet. A locally-added /packs/*.jpg always wins.
export default function PackImage({ pack, style, alt }) {
  const fallbacks = pack.imgCandidates || (pack.code ? packArtCandidates(pack.code) : []);
  const candidates = [...new Set([pack.img, ...fallbacks].filter(Boolean))];
  const [index, setIndex] = useState(0);

  if (index >= candidates.length) {
    return (
      <div style={{
        ...style,
        aspectRatio: '2 / 3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '12px',
        background: 'linear-gradient(160deg, var(--surface-2, #e5e7eb), var(--surface-1, #f3f4f6))',
        color: 'var(--text-muted)',
        fontWeight: 700,
        fontSize: '0.9rem',
      }}>
        {pack.name}
      </div>
    );
  }

  return (
    <img
      src={candidates[index]}
      alt={alt || pack.name}
      style={style}
      onError={() => setIndex(i => i + 1)}
    />
  );
}
