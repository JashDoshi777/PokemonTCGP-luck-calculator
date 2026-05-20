<div align="center">
  <img src="public/images/pocket_logo.webp" alt="Logo" width="180"/>
  <h1>🌟 Pokémon TCG Pocket Companion</h1>
  <p><strong>The ultimate, data-driven analytical companion for Pokémon TCG Pocket.</strong></p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" />
    <img alt="Vite" src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" />
    <img alt="NodeJS" src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/postgresql-4169e1?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img alt="GSAP" src="https://img.shields.io/badge/GSAP-88CE02.svg?style=for-the-badge&logo=GreenSock&logoColor=white" />
  </p>
</div>

<br />

> *"Did you really get lucky pulling that Crown Rare Charizard ex? Or was it just statistical inevitability?"*

Welcome to the **Pokémon TCG Pocket Companion**. Originally launched as the "Rotom Dex Engine" for evaluating pack luck, this project has evolved into a comprehensive, full-stack ecosystem. It now features a robust **Collection Tracker**, a custom **Deck Builder**, **Cloud Sync**, and **Meta Deck insights**—all wrapped in a premium, Apple-grade aesthetic.

---

## 📸 App Showcase

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Pack Analytics (Rotom Dex)</strong></td>
      <td align="center"><strong>Collection Tracker</strong></td>
      <td align="center"><strong>Custom Deck Builder</strong></td>
    </tr>
    <tr>
      <td><img src="public/images/screen2.jpeg" width="300" alt="Analytics"/></td>
      <td><img src="public/images/screen1.jpeg" width="300" alt="Collection Tracker"/></td>
      <td><img src="public/images/screen3.jpeg" width="300" alt="Deck Builder"/></td>
    </tr>
  </table>
</div>

---

## ✨ Core Functionality & Features

### 🎲 The Rotom Dex Engine (Luck Calculator)
Gacha games rely on complex probability matrices. The app dynamically adjusts depending on the set (e.g., *Genetic Apex*, *Mythical Island*) and calculates your exact mathematical expected value (EV) based on official datamined drop rates.
- **Z-Score Normalization**: Evaluates your pulls and assigns a clean **1 to 10 score**.
- **Visual Distribution**: See exactly which top % of players you fall into for specific rarities.

### 📚 Collection Tracker
A visually stunning Pokédex-style tracker for your entire card collection.
- 🎨 **Paint Mode**: Effortlessly drag your mouse (or swipe on mobile) across cards to quickly add them to your collection!
- 💖 **Wishlist Integration**: Pin cards you are hunting and track your progress separately.
- 📊 **Set Progress Rings**: View detailed completion percentages across all tracked expansions.

### 🃏 Custom Deck Builder
Construct your ultimate 20-card deck and save it to the cloud.
- 🔍 Search the entire catalog to find the exact cards you need.
- ⚖️ Enforces official deck rules (max 20 cards, max 2 copies of identical cards).
- 📸 **Export to Image**: Generate high-quality snapshots of your custom decks via `html2canvas` to share with friends and on social media!

### 🏆 Meta Decks Explorer
Explore the top-performing decks in the current Pokémon TCG Pocket meta.
- 🏅 View Tier 1 and Tier 2 decks.
- 📖 Inspect the full card lists and strategies in a beautiful, scrollable modal viewer.
- ⚡ Automatically pulls card images directly from the database.

### ☁️ Cloud Sync & Authentication
Your data isn't locked to a single device anymore.
- 🔒 **Secure Auth**: Built-in JWT authentication & password hashing (bcrypt).
- 🔄 **Real-time Sync**: Sync your collection progress, wishlist, and custom decks across multiple devices via our robust PostgreSQL backend.

---

## 🎨 Premium UI & User Experience

The application was designed to feel like a native, high-end iOS application running in the browser.

- 💎 **Apple-Grade Aesthetic**: Built from the ground up with high-end iOS glassmorphism styling and pixel-perfect UI elements.
- 🌊 **Fluid Animations**: Complex timeline animations and scroll triggers powered by **GSAP** (GreenSock).
- 🖱️ **Buttery Scrolling**: Utilizes **Lenis** for smooth, momentum-based scrolling across all views.
- 🌙 **Dark Mode Ready**: A gorgeous ambient background with shifting SVG blobs that dynamically responds to light/dark themes.
- 🖼️ **Authentic Assets**: Features exact in-game PNG rarity symbols (♢, ☆, ✨, 👑) and high-res booster pack box art for absolute immersion.

---

## 🃏 Tracked Rarities & Base Odds

The application tracks every official rarity level in the game. Here is a snapshot of the base global pool configuration before set-specific modifiers are applied:

| Rarity Level | In-Game Icon | Estimated Pull Weight | Notes |
| :--- | :---: | :--- | :--- |
| **Crown Rare** | 👑 | `~0.012%` | The absolute pinnacle of collecting. |
| **3-Star Immersive** | ☆☆☆ | `~0.222%` | Highly sought-after 3D interactive art. |
| **2-Star Special Art** | ☆☆ | `~0.500%` | Full art trainers and Pokémon. |
| **1-Star Illustration Rare** | ☆ | `~1.111%` | Beautiful, alternate-art basic cards. |
| **4-Diamond ex** | ♢♢♢♢ | `~1.666%` | Core meta staples. |
| **2-Shiny Double Shiny** | ✨✨ | `~0.100%` | Only available in Shiny-enabled expansions. |
| **1-Shiny Shiny Rare** | ✨ | `~0.300%` | Only available in Shiny-enabled expansions. |
| **God Pack** | 🌈 | `~0.050%` | Contains entirely rare pulls. Handled natively! |

---

## 📂 Project Architecture

A clean, full-stack architecture built for scaling:

```text
├── netlify/
│   ├── functions/         # Express.js Serverless API endpoints (api.js)
│   └── netlify.toml       # Serverless & routing deployment configuration
├── public/                # Static assets, high-res rarity symbols, images
├── src/
│   ├── components/        # Reusable UI (PokemonCard, AppleSearchBar, LoginModal)
│   ├── context/           # AppContext (Auth state, Cards DB, API sync logic)
│   ├── pages/             # Main Views (DeckBuilder, CollectionTracker, MetaDecks)
│   ├── data/              # Static meta decks, packs configs, and rarities
│   ├── math.js            # Probability engine & Z-Score algorithm
│   ├── index.css          # Global styling, design tokens, responsive queries
│   └── App.jsx            # Main view router & App Shell
├── index.html             # Application entry point
└── package.json           # Project dependencies
```

---

## 🚀 Getting Started (Local Development)

Want to run the Companion on your local machine? It's fully equipped for full-stack local development!

1. **Clone the repository**
   ```bash
   git clone https://github.com/JashDoshi777/PokemonTCGP-luck-calculator.git
   cd PokemonTCGP-luck-calculator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup (PostgreSQL)**
   - You will need a PostgreSQL database (e.g., Neon, Supabase, or a local instance).
   - Create a `.env` file in the root directory:
     ```env
     DATABASE_URL=postgres://user:password@host:port/dbname
     JWT_SECRET=your_super_secret_key_here
     RUN_LOCAL=true
     PORT=3001
     ```
   - Start the backend and initialize the database tables by visiting `http://localhost:3001/api/init` in your browser.

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *Your Vite frontend will be live at `http://localhost:5173/`*

---

## 🔮 What's Next? (Roadmap)

We are constantly updating the app alongside new Pokémon TCG Pocket set releases. Up next:
- [ ] **Infinite Pack Simulator**: A zero-friction visual gacha simulator using real drop rates.
- [ ] **Competitive "Brick" Calculator**: A Monte Carlo hand simulator for competitive players.
- [ ] **Trade Fairness Evaluator**: A pure math calculator for evaluating GTS trade fairness.
- [ ] **Social Sharing**: Direct links to view other trainers' collections and decks.

---

<div align="center">
  <i>May your daily pulls be blessed. 🍀</i>
</div>
