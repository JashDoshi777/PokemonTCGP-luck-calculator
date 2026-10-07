<div align="center">
  <img src="public/images/pocket_logo.webp" alt="Logo" width="160"/>
  <h1>Pokémon TCG Pocket Companion</h1>
  <p><strong>Luck calculator · collection tracker · deck builder · live meta decks · card trading</strong><br/>A free, fan-made toolkit for Pokémon TCG Pocket players.</p>

  <p>
    <a href="https://pocket-luck.netlify.app"><img alt="Live app" src="https://img.shields.io/badge/LIVE%20APP-pocket--luck.netlify.app-ff9500?style=for-the-badge" /></a>
  </p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" />
    <img alt="Vite" src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" />
    <img alt="Node" src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/postgresql-4169e1?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img alt="Netlify" src="https://img.shields.io/badge/netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" />
  </p>
</div>

<br />

> *"Did you really get lucky pulling that Crown Rare Charizard ex? Or was it just statistical inevitability?"*

**👉 Try it: [pocket-luck.netlify.app](https://pocket-luck.netlify.app)**

It started as a luck calculator and grew into a full companion app: track your collection, build and share decks, follow the live meta, and find trading partners. Everything works on phones and laptops, in light and dark mode, and a free account syncs your data across devices.

---

## 📸 App Showcase

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Pack Analytics</strong></td>
      <td align="center"><strong>Collection Tracker</strong></td>
      <td align="center"><strong>Deck Builder</strong></td>
    </tr>
    <tr>
      <td><img src="public/images/screen2.jpeg" width="300" alt="Analytics"/></td>
      <td><img src="public/images/screen1.jpeg" width="300" alt="Collection Tracker"/></td>
      <td><img src="public/images/screen3.jpeg" width="300" alt="Deck Builder"/></td>
    </tr>
  </table>
</div>

---

## ✨ Features

### 🎲 Luck Calculator
Enter what you pulled and see how it compares with the published odds.
- **Overall luck** across all packs, or **set-specific luck** for one expansion (Dex).
- A **1–10 luck score** plus, for every rarity, exactly which top % of players you fall into.
- **God Pack and Shiny God Pack** are scored alongside the card rarities, and Deluxe / Mega Deluxe ex packs are handled separately.
- Rare events use an exact Poisson calculation; the headline score uses the same percentiles you see on screen, so the numbers always agree.
- Inputs are capped and validated, so it stays instant whatever you type.

### 📖 Pack Archive (Dex)
Every official expansion with its own calculator. New sets are **picked up automatically** from the live card database (including shiny and guaranteed-ex mechanics), with pack art for old and new sets.

### 🗂️ Collection Tracker
- **Paint mode**: drag (or swipe) across cards to mark them as owned.
- **Wishlist**, ownership filters (All / Owned / Missing) and **multi-select rarity and energy filters**.
- **Set progress rings** and completion per expansion.
- Cards load in batches with placeholders, and artwork is served as lightweight thumbnails, so big sets stay fast on mobile data.
- Fully usable with the keyboard (Enter adds a copy, Backspace removes one).

### 🔥 Live Meta Decks
The current top-performing deck for **each energy type**, built from live match data, with the full 20-card list. Shows a clear message and a retry button if the data source is unreachable.

### 🃏 Deck Builder
- Build a 20-card deck with the real rules (max 2 copies of a card).
- **Save to your account**, then **edit or delete** decks later.
- **Export as an image** to share (the image library loads only when you export).

### 🔁 Trading Center
- List the cards you can offer and the cards you want (or import your wishlist).
- **Automatic matching** with other players, with unread-message badges.
- **In-app chat** and **endorsements** for trustworthy traders (a real conversation and an account at least a day old are required, to keep it fair).
- Your **in-game ID** comes from your profile.

### 👤 Profiles
Pick a **Pokémon avatar** (any of the 1,025) with a background colour, set your email and in-game ID, and see your luck score, collection and trading stats in one place.

### 📊 Admin Dashboard
Account(s) listed in `ADMIN_USERNAMES` get a **Profile | Dashboard** switch with visitors, sign-ups, the Pro waitlist, active users, section popularity, audience and conversion charts, adoption stats and recent activity. Analytics are anonymous: a random browser id, no cookies and no IP addresses, and the admin's own visits and obvious bots are excluded.

### ☁️ Cloud Sync & Accounts
- JWT sessions with bcrypt-hashed passwords.
- Collection, wishlist and decks sync across devices. Sync is **safe by design**: nothing is uploaded until your saved data has been downloaded successfully, unsynced edits survive an expired session, and a failed load never overwrites your cloud copy.

### 🌟 Pro (coming soon)
A "notify me" waitlist for an optional Pro tier. Free features may move to Pro when it launches; anything that changes will be announced first.

---

## 🎨 Design & Experience

- **Apple-style glass UI** with dark mode and a drifting ambient background.
- **Smooth scrolling** (Lenis) and scroll-driven animations (GSAP) on the landing page.
- **Responsive for real**: phone menu drawer, compact one-row-per-rarity calculator, and layouts checked from 320 px phones to wide laptops.
- **Accessible**: keyboard navigation, focus rings, Escape to close dialogs with a proper focus trap and focus return, skip link, labelled controls, comfortable touch targets, and reduced-motion support.

---

## 🛡️ Security & Reliability

- **Strict input validation** on every endpoint (types, sizes, card ids), JSON stored in compact validated form, and database constraints that keep stored data well-formed.
- **Case-insensitive unique usernames** and reserved names, so nobody can impersonate an admin by changing capitalisation.
- **Brute-force protection**: durable per-account and per-network lockouts in the database, rate limits on every write path, and the client IP is taken from the platform's trusted header (never from a spoofable one).
- **Admin access** is decided on the server from the signed token and an environment variable, never from anything the browser sends.
- **JWT hardening** (pinned algorithm, expiry → clean sign-out), CORS closed by default, `no-store` API responses, and a global error handler that never leaks stack traces.
- **Security headers** with a Content-Security-Policy that allows only the hosts the app uses (see `netlify.toml`).
- Database TLS certificates are verified.
- Errors are isolated per page: a problem in one section shows a retry card instead of taking down the whole app.

---

## 🏗️ Tech Stack

| Layer | Tools |
| :--- | :--- |
| Front end | React 19, Vite, GSAP, Lenis, lucide-react |
| API | Express 5 on Netlify Functions (`serverless-http`) |
| Database | PostgreSQL (Neon) via `pg` |
| Auth | JWT + bcryptjs |
| Data | Community card database and tier lists served from the jsDelivr CDN |
| Hosting | Netlify (static site + function) |

---

## 📂 Project Structure

```text
├── netlify/
│   └── functions/
│       └── api.js         # Express API: auth, sync, trading, chat, profile, admin analytics
├── netlify.toml           # Build, API routing, security headers (CSP) and caching
├── public/                # Static assets, rarity symbols, images
├── src/
│   ├── components/        # Nav, modals, avatars, admin dashboard, error boundary
│   ├── context/           # AppContext: session, safe cloud sync, card catalog
│   ├── hooks/             # useDialog (Escape / focus trap for modals)
│   ├── pages/             # Landing, Calculator, Dex, Meta, Decks, Collection, Trading, Profile
│   ├── services/          # Card DB, packs, meta decks, energy map, analytics, HTTP helper
│   ├── styles/            # Shared control styles
│   ├── utils/             # Safe storage, visitor id, card image helper
│   ├── data/              # Packs, rarities and avatar configuration
│   ├── math.js            # Probability engine and luck score
│   └── App.jsx            # App shell: navigation, modals, lazy-loaded pages
├── index.html
└── package.json
```

---

## 🚀 Getting Started (Local Development)

1. **Clone and install**
   ```bash
   git clone https://github.com/JashDoshi777/PokemonTCGP-luck-calculator.git
   cd PokemonTCGP-luck-calculator
   npm install
   ```

2. **Create a PostgreSQL database** (Neon, Supabase or local) and copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SECRET` and `ADMIN_USERNAMES`. Generate strong secrets with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   The app is at `http://localhost:5173/` (the API is served on the same address).

4. **Create / upgrade the database tables** (safe to re-run any time):
   ```bash
   curl -X POST http://localhost:5173/api/init -H "X-Admin-Secret: <your ADMIN_SECRET>"
   ```

### Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Dev server with the API |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

---

## ☁️ Deploying to Netlify

1. Connect the repo. `netlify.toml` already sets the build command, publish folder, API routing and security headers.
2. In **Site configuration → Environment variables** add:

   | Variable | Purpose |
   | :--- | :--- |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Signs login tokens (long and random; changing it signs everyone out) |
   | `ADMIN_SECRET` | Protects the `/api/init` setup request |
   | `ADMIN_USERNAMES` | Comma-separated usernames that can open the admin dashboard |

   Variables only apply to **new deploys**, so redeploy after changing them.
3. After the first deploy (and after any release that changes the schema), run the setup request once:
   ```bash
   curl -X POST https://<your-site>/api/init -H "X-Admin-Secret: <your ADMIN_SECRET>"
   ```
4. **Tip:** set the Netlify Functions region to match your database region for the fastest logins.

> ⚠️ Netlify's secret scanner fails a build if the *value* of an environment variable appears anywhere in the code or docs. Never write real admin usernames or secrets into the repository.

---

## 🔌 API Overview

All routes live under `/api` and return JSON. Routes marked 🔒 need a `Bearer` token.

| Area | Routes |
| :--- | :--- |
| Auth | `POST /register`, `POST /login` |
| Sync 🔒 | `GET /sync`, `POST /sync` (collection, wishlist, decks) |
| Profile 🔒 | `GET /profile`, `PUT /profile`, `GET /user` |
| Trading 🔒 | `GET/POST /trade`, `GET /trade/matches`, `GET /trade/notifications`, `POST /trade/endorse/:userId` |
| Chat 🔒 | `GET/POST /chat/:userId` |
| Pro waitlist | `POST /pro/waitlist`, `GET /pro/waitlist/status` |
| Analytics | `POST /track` (anonymous), `GET /admin/stats` 🔒 (admin only) |
| Setup | `POST /init` (needs `X-Admin-Secret`) |

---

## 🃏 Tracked Rarities

The calculator scores every rarity the game uses: Crown Rare, 3-Star Immersive, 2-Star Special Art, 1-Star Illustration Rare, 4-Diamond ex, Shiny and Double Shiny (in shiny-enabled sets), plus God Pack and Shiny God Pack. Base odds live in `src/data.js`; set-specific rules (shiny slots, guaranteed-ex packs, shiny God Packs) are detected automatically from the live pull-rate data.

---

## 🙏 Data Sources & Credits

- Card database and pull rates: [pokemon-tcg-pocket-database](https://www.npmjs.com/package/pokemon-tcg-pocket-database)
- Card art and meta tier lists: the community [PocketDecks](https://github.com/PocketDecks) projects and [pokemon-tcg-exchange](https://github.com/flibustier/pokemon-tcg-exchange)
- Pokémon avatars: [PokeAPI sprites](https://github.com/PokeAPI/sprites)
- Pack logos: [TCGdex](https://tcgdex.net)
- Thumbnails are resized on the fly by [wsrv.nl](https://wsrv.nl)

---

## ⚖️ Disclaimer

This is an unofficial fan project. It is **not affiliated with or endorsed by Nintendo, The Pokémon Company, Creatures Inc. or DeNA**. Pokémon and Pokémon TCG Pocket are trademarks of their respective owners. The luck score is a statistical estimate based on published pull rates, so treat it as fun rather than gospel.

---

## 🔮 Roadmap

- [ ] "Share my luck score" image card
- [ ] Optional Pro tier with extra tools
- [ ] Public trader profiles and shareable collections
- [ ] Infinite pack simulator using real drop rates
- [ ] Trade fairness evaluator

---

## 💬 Feedback

Found a bug or want a feature? Open an issue, or tell me what you'd use every day. Feedback shapes what gets built next.

<div align="center">
  <i>May your daily pulls be blessed. 🍀</i>
</div>
