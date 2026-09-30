import { getVisitorId } from '../utils/visitor';
import { local, session } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SESSION_FLAG = 'tcgp_session_tracked';

// Anonymous, first-party usage counting for the admin dashboard. It sends only
// a random per-browser id, the event kind and the section name; failures are
// swallowed so analytics can never affect the app.
function send(payload) {
  try {
    const token = local.get('tcgp_token');
    fetch(`${API_URL}/track`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ visitorId: getVisitorId(), ...payload })
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Once per browser tab session.
export function trackSession() {
  if (session.get(SESSION_FLAG)) return;
  session.set(SESSION_FLAG, '1');
  send({ kind: 'session' });
}

let lastView = null;
let lastViewAt = 0;

export function trackView(view) {
  // Ignore an immediate repeat of the same view (e.g. React re-running an effect).
  const now = Date.now();
  if (view === lastView && now - lastViewAt < 2000) return;
  lastView = view;
  lastViewAt = now;
  send({ kind: 'view', view });
}
