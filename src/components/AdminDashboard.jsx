import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import PokemonAvatar from './PokemonAvatar';
import { session } from '../utils/storage';
import './AdminDashboard.css';

const RANGES = [7, 30, 90];

const COLORS = {
  blue: '#0a84ff',
  green: '#30d158',
  orange: '#ff9f0a',
  purple: '#bf5af2',
};

const SECTION_LABELS = {
  home: 'Home', calc: 'Calculator', dex: 'Dex', meta: 'Meta decks',
  decks: 'Deck builder', collection: 'Collection', trading: 'Trading', profile: 'Profile',
};

const nf = new Intl.NumberFormat('en-US');
const fmt = (n) => nf.format(Math.round(n || 0));
const fmtCompact = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : fmt(n));

function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const dayLabel = (iso) => parseDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLabelLong = (iso) => parseDay(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Axis ceiling that lands on friendly numbers: 4, 5, 8, 10, 20, 40, 50, 80, 100 ...
function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 4, 5, 8, 10]) {
    if (step * pow >= v) return step * pow;
  }
  return 10 * pow;
}

// Monotone cubic interpolation (Fritsch-Carlson): smooth like iOS charts but
// never overshoots a data point, so a flat run of zeros stays flat.
function smoothPath(pts) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3, c1y = pts[i].y + (t[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3, c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function toPoints(values, max, pad = 0) {
  const n = values.length;
  return values.map((v, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: 100 - pad - (v / max) * (100 - pad * 2),
  }));
}

/* ---------- small visual pieces ---------- */

const Delta = ({ value }) => {
  if (value === null) return <span className="adm-delta neutral">New</span>;
  if (value === 0) return <span className="adm-delta neutral"><Minus size={11} strokeWidth={3} /> 0%</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`adm-delta ${up ? 'up' : 'down'}`}>
      <Icon size={11} strokeWidth={3} /> {Math.abs(value)}%
    </span>
  );
};

const Sparkline = ({ values, color }) => {
  const id = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current;
  const max = Math.max(...values, 1);
  const pts = toPoints(values, max, 8);
  const line = smoothPath(pts);
  return (
    <svg className="adm-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
};

const StatTile = ({ label, value, sub, change, values, color }) => (
  <div className="glass-card adm-tile">
    <div className="adm-label">{label}</div>
    <div className="adm-tile-row">
      <div className="adm-big">{value}</div>
      {change !== undefined && <Delta value={change} />}
    </div>
    <div className="adm-sub">{sub}</div>
    {values && <Sparkline values={values} color={color} />}
  </div>
);

const Ring = ({ segments, size = 92, stroke = 11, centerTop, centerBottom }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="adm-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(128,128,140,0.18)" strokeWidth={stroke} />
        {total > 0 && segments.map((seg) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.label}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke} strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="adm-ring-center">
        <strong>{centerTop}</strong>
        <span>{centerBottom}</span>
      </div>
    </div>
  );
};

/* ---------- interactive area chart ---------- */

const AreaChart = ({ days, values, color, unit }) => {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const gid = useRef(`ac${Math.random().toString(36).slice(2, 8)}`).current;

  const max = niceMax(Math.max(...values, 0));
  const pts = toPoints(values, max, 0);
  const line = smoothPath(pts);
  const n = values.length;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  const labelIdx = useMemo(() => {
    const want = n <= 7 ? n : 5;
    return Array.from(new Set(Array.from({ length: want }, (_, i) => Math.round((i / (want - 1)) * (n - 1)))));
  }, [n]);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(f * (n - 1)));
  };

  const hx = hover === null ? 0 : pts[hover].x;
  const hy = hover === null ? 0 : pts[hover].y;
  const tipShift = hx < 22 ? '0%' : hx > 78 ? '-100%' : '-50%';

  return (
    <div className="adm-chart">
      <div className="adm-chart-plot" ref={ref} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((tk, i) => (
          <div key={tk + '-' + i} className="adm-grid" style={{ bottom: `${(tk / max) * 100}%` }}>
            <span>{fmtCompact(tk)}</span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {hover !== null && (
          <>
            <div className="adm-cursor" style={{ left: `${hx}%` }} />
            <div className="adm-dot" style={{ left: `${hx}%`, top: `${hy}%`, background: color }} />
            <div className="adm-tip" style={{ left: `${hx}%`, transform: `translateX(${tipShift})` }}>
              <div>{dayLabelLong(days[hover])}</div>
              <strong>{fmt(values[hover])} <span>{unit}</span></strong>
            </div>
          </>
        )}
      </div>
      <div className="adm-xaxis">
        {labelIdx.map((i, k) => (
          <span
            key={i}
            style={{
              left: `${(i / (n - 1)) * 100}%`,
              transform: k === 0 ? 'none' : k === labelIdx.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {dayLabel(days[i])}
          </span>
        ))}
      </div>
    </div>
  );
};

const BarRow = ({ label, value, total, color = COLORS.blue, right }) => {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="adm-bar-row">
      <div className="adm-bar-head">
        <span>{label}</span>
        <span className="adm-bar-num">{right ?? fmt(value)}</span>
      </div>
      <div className="adm-bar-track"><div style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
};

/* ---------- dashboard ---------- */

const METRICS = [
  { key: 'visitors', label: 'Visitors', unit: 'visitors', color: COLORS.blue },
  { key: 'sessions', label: 'Sessions', unit: 'sessions', color: COLORS.purple },
  { key: 'newUsers', label: 'Sign-ups', unit: 'sign-ups', color: COLORS.green },
  { key: 'waitlist', label: 'Waitlist', unit: 'joins', color: COLORS.orange },
];

const AdminDashboard = () => {
  const { authFetch } = useAppContext();
  const [days, setDays] = useState(() => {
    const stored = parseInt(session.get('tcgp_admin_days'), 10);
    return RANGES.includes(stored) ? stored : 30;
  });
  const [metric, setMetric] = useState('visitors');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only the newest request may update the screen, so flipping quickly between
  // 7D / 30D / 90D can never leave numbers from one range under another's label.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/admin/stats?days=${days}`);
      if (res.status === 403) throw new Error('This account does not have admin access.');
      if (!res.ok) throw new Error('Could not load the dashboard.');
      const payload = await res.json();
      if (seq === requestSeq.current) setData(payload);
    } catch (e) {
      if (seq === requestSeq.current) setError(e.message || 'Could not load the dashboard.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [days, authFetch]);

  useEffect(() => { load(); }, [load]);

  const changeRange = (d) => {
    setDays(d);
    session.set('tcgp_admin_days', String(d));
  };

  const header = (
    <div className="adm-header">
      <div>
        <h3 className="adm-title">Dashboard</h3>
        <div className="adm-subtitle">
          {data ? `Updated ${timeAgo(data.generatedAt)}` : 'Live usage across the app'}
        </div>
      </div>
      <div className="adm-controls">
        <div className="apple-segmented-control adm-range" role="tablist" aria-label="Date range">
          {RANGES.map((d) => (
            <button key={d} role="tab" aria-selected={days === d} className={`segmented-btn ${days === d ? 'active' : ''}`} onClick={() => changeRange(d)}>
              {d}D
            </button>
          ))}
        </div>
        <button className={`adm-refresh ${loading ? 'spinning' : ''}`} onClick={load} aria-label="Refresh" disabled={loading}>
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );

  if (error && !data) {
    return (
      <div className="adm-root">
        {header}
        <div className="glass-card adm-card adm-error">
          <p>{error}</p>
          <button className="profile-change-avatar" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="adm-root">
        {header}
        <div className="adm-tiles">
          {[0, 1, 2, 3].map(i => <div key={i} className="glass-card adm-tile adm-skeleton" />)}
        </div>
        <div className="glass-card adm-card adm-skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const { overview, period, change, series, sections, engagement, waitlist, recentUsers } = data;
  const shownDays = data.days; // the range the numbers on screen actually cover
  const active = METRICS.find(m => m.key === metric);
  const activeValues = series[metric];
  const activeTotal = metric === 'visitors' ? period.visitors : activeValues.reduce((s, v) => s + v, 0);
  const sectionTotal = Math.max(1, sections.reduce((s, x) => s + x.views, 0));
  const users = Math.max(1, overview.totalUsers);
  const signupRate = period.visitors > 0 ? (period.newUsers / period.visitors) * 100 : 0;
  const waitlistRate = period.visitors > 0 ? (period.waitlist / period.visitors) * 100 : 0;
  const noTraffic = period.visitors === 0;

  return (
    <div className={`adm-root ${loading ? 'is-refreshing' : ''}`}>
      {header}

      {error && (
        <div className="adm-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load}>Try again</button>
        </div>
      )}

      <div className="adm-tiles">
        <StatTile
          label="Visitors" value={fmt(period.visitors)} change={change.visitors}
          sub={`${fmt(overview.totalVisitors)} all time`} values={series.visitors} color={COLORS.blue}
        />
        <StatTile
          label="New sign-ups" value={fmt(period.newUsers)} change={change.newUsers}
          sub={`${fmt(overview.totalUsers)} total accounts`} values={series.newUsers} color={COLORS.green}
        />
        <StatTile
          label="Pro waitlist" value={fmt(waitlist.total)} change={change.waitlist}
          sub={`+${fmt(period.waitlist)} in ${shownDays} days`} values={series.waitlist} color={COLORS.orange}
        />
        <StatTile
          label="Active this week" value={fmt(overview.active7d)}
          sub={`${fmt(overview.active24h)} in the last 24h`}
        />
      </div>

      <div className="glass-card adm-card">
        <div className="adm-chart-head">
          <div>
            <div className="adm-label">{active.label} · last {shownDays} days</div>
            <div className="adm-big">{fmt(activeTotal)}</div>
            <div className="adm-sub">{(activeValues.reduce((s, v) => s + v, 0) / Math.max(1, activeValues.length)).toFixed(1)} per day on average</div>
          </div>
          <div className="adm-chips" role="tablist" aria-label="Metric">
            {METRICS.map(m => (
              <button
                key={m.key} role="tab" aria-selected={metric === m.key}
                className={`adm-chip ${metric === m.key ? 'active' : ''}`}
                style={metric === m.key ? { '--chip': m.color } : undefined}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart days={series.days} values={activeValues} color={active.color} unit={active.unit} />
        {noTraffic && (
          <div className="adm-note">
            No visits recorded in this period yet. Tracking began {data.trackingSince ? dayLabel(data.trackingSince.slice(0, 10)) : 'today'} — numbers fill in as people use the app.
          </div>
        )}
      </div>

      <div className="adm-grid-2">
        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Where people go</h4>
          <div className="adm-card-sub">Section views · last {days} days</div>
          {sections.length === 0 ? (
            <div className="adm-empty">No section views yet.</div>
          ) : (
            sections.map((s, i) => (
              <BarRow
                key={s.view}
                label={SECTION_LABELS[s.view] || s.view}
                value={s.views}
                total={sections[0].views}
                color={COLORS.blue}
                right={`${fmt(s.views)} · ${Math.round((s.views / sectionTotal) * 100)}%`}
              />
            ))
          )}
        </div>

        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Audience</h4>
          <div className="adm-card-sub">Who is visiting and who is signing up</div>
          <div className="adm-rings">
            <div className="adm-ring-block">
              <Ring
                segments={[
                  { label: 'new', value: period.newVisitors, color: COLORS.blue },
                  { label: 'returning', value: period.returningVisitors, color: COLORS.green },
                ]}
                centerTop={fmt(period.visitors)} centerBottom="visitors"
              />
              <ul className="adm-legend">
                <li><i style={{ background: COLORS.blue }} />New <b>{fmt(period.newVisitors)}</b></li>
                <li><i style={{ background: COLORS.green }} />Returning <b>{fmt(period.returningVisitors)}</b></li>
              </ul>
            </div>
            <div className="adm-ring-block">
              <Ring
                segments={[
                  { label: 'accounts', value: waitlist.registered, color: COLORS.orange },
                  { label: 'guests', value: waitlist.anonymous, color: COLORS.purple },
                ]}
                centerTop={fmt(waitlist.total)} centerBottom="waitlist"
              />
              <ul className="adm-legend">
                <li><i style={{ background: COLORS.orange }} />Accounts <b>{fmt(waitlist.registered)}</b></li>
                <li><i style={{ background: COLORS.purple }} />Guests <b>{fmt(waitlist.anonymous)}</b></li>
              </ul>
            </div>
          </div>
          <div className="adm-facts adm-facts-3">
            <div><strong>{fmt(period.sessions)}</strong><span>sessions</span></div>
            <div><strong>{fmt(period.pageViews)}</strong><span>page views</span></div>
            <div><strong>{period.sessions > 0 ? (period.pageViews / period.sessions).toFixed(1) : '—'}</strong><span>views / session</span></div>
          </div>
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Conversion</h4>
          <div className="adm-card-sub">From visit to sign-up · last {days} days</div>
          <BarRow label="Visitors" value={period.visitors} total={period.visitors} color={COLORS.blue} right={fmt(period.visitors)} />
          <BarRow label="Signed up" value={period.newUsers} total={period.visitors} color={COLORS.green} right={`${fmt(period.newUsers)} · ${signupRate.toFixed(1)}%`} />
          <BarRow label="Joined Pro waitlist" value={period.waitlist} total={period.visitors} color={COLORS.orange} right={`${fmt(period.waitlist)} · ${waitlistRate.toFixed(1)}%`} />
          <div className="adm-fineprint">Sign-ups can include people who first visited before this period.</div>
        </div>

        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Active accounts</h4>
          <div className="adm-card-sub">Share of all {fmt(overview.totalUsers)} accounts</div>
          <BarRow label="Last 24 hours" value={overview.active24h} total={users} color={COLORS.green} right={`${fmt(overview.active24h)} · ${Math.round((overview.active24h / users) * 100)}%`} />
          <BarRow label="Last 7 days" value={overview.active7d} total={users} color={COLORS.green} right={`${fmt(overview.active7d)} · ${Math.round((overview.active7d / users) * 100)}%`} />
          <BarRow label="Last 30 days" value={overview.active30d} total={users} color={COLORS.green} right={`${fmt(overview.active30d)} · ${Math.round((overview.active30d / users) * 100)}%`} />
          <div className="adm-fineprint">Based on each account's last activity.</div>
        </div>
      </div>

      <div className="glass-card adm-card">
        <h4 className="adm-card-title">What accounts do</h4>
        <div className="adm-card-sub">Adoption across {fmt(overview.totalUsers)} accounts</div>
        <div className="adm-adopt">
          <BarRow label="Built a collection" value={engagement.withCollection} total={users} color={COLORS.blue} right={`${fmt(engagement.withCollection)} · ${Math.round((engagement.withCollection / users) * 100)}%`} />
          <BarRow label="Ran the luck calculator" value={engagement.withLuck} total={users} color={COLORS.purple} right={`${fmt(engagement.withLuck)} · ${Math.round((engagement.withLuck / users) * 100)}%`} />
          <BarRow label="Saved a deck" value={engagement.withDecks} total={users} color={COLORS.orange} right={`${fmt(engagement.withDecks)} · ${Math.round((engagement.withDecks / users) * 100)}%`} />
          <BarRow label="Has a trade listing" value={engagement.withListing} total={users} color={COLORS.green} right={`${fmt(engagement.withListing)} · ${Math.round((engagement.withListing / users) * 100)}%`} />
          <BarRow label="Added an in-game ID" value={engagement.withInGameId} total={users} color={COLORS.blue} right={`${fmt(engagement.withInGameId)} · ${Math.round((engagement.withInGameId / users) * 100)}%`} />
          <BarRow label="Added an email" value={engagement.withEmail} total={users} color={COLORS.purple} right={`${fmt(engagement.withEmail)} · ${Math.round((engagement.withEmail / users) * 100)}%`} />
        </div>
        <div className="adm-facts">
          <div><strong>{fmt(engagement.totalDecks)}</strong><span>decks saved</span></div>
          <div><strong>{fmt(engagement.messages)}</strong><span>trade messages</span></div>
          <div><strong>{fmt(engagement.endorsements)}</strong><span>endorsements</span></div>
          <div><strong>{engagement.avgLuck === null ? '—' : engagement.avgLuck.toFixed(1)}</strong><span>avg reported luck</span></div>
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Newest trainers</h4>
          <div className="adm-card-sub">Latest sign-ups</div>
          {recentUsers.length === 0 ? <div className="adm-empty">No accounts yet.</div> : (
            <ul className="adm-list">
              {recentUsers.map(u => (
                <li key={u.username}>
                  <PokemonAvatar avatar={u.avatar} name={u.username} size={36} />
                  <span className="adm-list-main">{u.username}</span>
                  <span className="adm-list-meta">{timeAgo(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card adm-card">
          <h4 className="adm-card-title">Pro waitlist</h4>
          <div className="adm-card-sub">{fmt(waitlist.total)} total · {fmt(waitlist.last7Days)} this week</div>
          {waitlist.recent.length === 0 ? <div className="adm-empty">Nobody has joined yet.</div> : (
            <ul className="adm-list">
              {waitlist.recent.map((w, i) => (
                <li key={`${w.username || 'guest'}-${w.createdAt}-${i}`}>
                  <span className={`adm-badge ${w.username ? 'acct' : 'guest'}`}>{(w.username || 'G').charAt(0).toUpperCase()}</span>
                  <span className="adm-list-main">
                    {w.username || 'Guest visitor'}
                    {w.email && <small>{w.email}</small>}
                  </span>
                  <span className="adm-list-meta">{timeAgo(w.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="adm-footnote">
        Visitors are counted with an anonymous random browser id (no IP address or cookies). Your own visits are excluded. Days are in UTC.
        {data.trackingSince && ` Tracking since ${new Date(data.trackingSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`}
      </div>
    </div>
  );
};

export default AdminDashboard;
