import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './LoginModal.css';
import './ProModal.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const VISITOR_KEY = 'tcgp_visitor_id';
const JOINED_CACHE_PREFIX = 'tcgp_pro_joined:';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let memoryVisitorId = null;

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// A random id kept in this browser so anonymous signups are counted once per
// person. Falls back to a per-page-load id if storage is blocked.
function getVisitorId() {
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

// The server is the source of truth for "already joined", but its round trip
// takes a moment - remembering the last answer locally lets the popup render
// the right state instantly instead of waiting on the network.
function readJoinedCache(user) {
  try {
    return localStorage.getItem(JOINED_CACHE_PREFIX + (user || 'guest'));
  } catch {
    return null;
  }
}

function writeJoinedCache(user, value) {
  try {
    const key = JOINED_CACHE_PREFIX + (user || 'guest');
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable - the server state still applies
  }
}

const ProModal = ({ onClose, onRequestLogin }) => {
  const { user, token } = useAppContext();
  const [visitorId] = useState(getVisitorId);
  const cached = readJoinedCache(user);
  const [joined, setJoined] = useState(!!cached);
  const [email, setEmail] = useState(user && cached && cached !== '1' ? cached : '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/pro/waitlist/status?visitorId=${encodeURIComponent(visitorId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error('status request failed');
      const data = await res.json();
      if (!mounted.current) return;
      setJoined(!!data.joined);
      setIsAdmin(!!data.isAdmin);
      setStats(data.stats || null);
      if (data.email) setEmail(data.email);
      writeJoinedCache(user, data.joined ? (data.email || '1') : null);
    } catch (e) {
      console.error('Could not load Pro waitlist status:', e);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [user, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (user && !EMAIL_PATTERN.test(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Optimistic: show the confirmation right away and only roll back if the
    // request actually fails, so there's no waiting on the network.
    setJoined(true);
    writeJoinedCache(user, user ? cleanEmail : '1');

    try {
      const res = await fetch(`${API_URL}/pro/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ visitorId, email: user ? cleanEmail : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      loadStatus();
    } catch (err) {
      if (!mounted.current) return;
      setJoined(false);
      writeJoinedCache(user, null);
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleSignIn = () => {
    onClose();
    onRequestLogin();
  };

  return (
    <div className="login-modal-overlay pro-modal-overlay" onClick={onClose}>
      <div className="login-modal-container pro-modal-container" onClick={e => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="login-modal-header">
          <div className="pro-modal-badge">PRO</div>
          <h2>Pro is coming soon</h2>
          <p>Extra tools for serious collectors and traders.</p>
        </div>

        <div className="login-modal-body">
          <div className="pro-modal-notice">
            Heads up: some features that are free today may move to Pro when it launches.
          </div>

          {joined ? (
            <div className="pro-modal-success">
              <div className="pro-modal-success-icon"><Check size={22} /></div>
              <div className="pro-modal-success-title">You're on the list!</div>
              {user ? (
                <div className="pro-modal-muted">We'll email {email || 'you'} when Pro is live.</div>
              ) : (
                <div className="pro-modal-muted">
                  We've counted your interest. You're not signed in, so we can't email you yet —{' '}
                  <button type="button" className="pro-modal-link" onClick={handleSignIn}>sign in</button>
                  {' '}and add your email to get notified.
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="auth-error-msg">{error}</div>}

              {user ? (
                <div className="apple-input-group">
                  <input
                    type="email"
                    className="apple-input"
                    placeholder="Your email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="pro-modal-muted pro-modal-guest-hint">
                  Not signed in? We'll just count your interest.{' '}
                  <button type="button" className="pro-modal-link" onClick={handleSignIn}>Sign in</button>
                  {' '}to get an email when Pro launches.
                </div>
              )}

              <button type="submit" className="apple-btn-primary">
                Let me know when it's live
              </button>
            </form>
          )}

          {isAdmin && stats && (
            <div className="pro-modal-admin">
              <div className="pro-modal-admin-title">Admin · Pro waitlist</div>
              <div className="pro-modal-admin-grid">
                <div><strong>{stats.total}</strong><span>Total</span></div>
                <div><strong>{stats.registered}</strong><span>With email</span></div>
                <div><strong>{stats.anonymous}</strong><span>Anonymous</span></div>
                <div><strong>{stats.last7Days}</strong><span>Last 7 days</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProModal;
