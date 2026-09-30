const VISITOR_KEY = 'tcgp_visitor_id';

let memoryVisitorId = null;

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// A random id kept in this browser so an anonymous person is counted once
// (waitlist signups, visitor analytics). Falls back to a per-page-load id if
// storage is blocked.
export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = generateId();
    return memoryVisitorId;
  }
}
