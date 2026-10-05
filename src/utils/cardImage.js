// Card art comes from a community CDN at ~370px wide (about 50 KB each), far more than a
// grid thumbnail needs. Thumbnails are requested through the free wsrv.nl image
// resizer at 280px / quality 70 instead (about 19 KB, cached at its edge for a year).
//
// The resizer is an optimisation, never a dependency: every card lists the original
// image as its fallback, and after a few resizer failures it is skipped altogether.
const RESIZER = 'https://wsrv.nl/';
const MAX_FAILURES = 3;
export const THUMBNAIL_WIDTH = 280;

let failures = 0;

// Image URLs to try, best first.
export function cardImageSources(url, width = THUMBNAIL_WIDTH) {
  if (!url) return [];
  if (failures >= MAX_FAILURES) return [url];
  const withoutScheme = url.replace(/^https?:\/\//, '');
  return [`${RESIZER}?url=${encodeURIComponent(withoutScheme)}&w=${width}&q=70&output=webp`, url];
}

export function isResizedSource(src) {
  return typeof src === 'string' && src.startsWith(RESIZER);
}

export function reportResizerFailure() {
  failures += 1;
}
