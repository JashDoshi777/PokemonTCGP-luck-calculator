<div align="center">
  <img src="public/images/pocket_logo.webp" alt="Logo" width="150"/>
  <h1>Pokémon TCG Pocket Luck Calculator</h1>
  <p><strong>The ultimate mathematical companion for Pokémon TCG Pocket.</strong></p>
</div>

<br />

The **Pokémon TCG Pocket Luck Calculator** is a premium, client-side React application that calculates the true probability and luck of your booster pack pulls. By mapping directly to official drop rates, the engine analyzes your pulls to assign a "Z-Score", letting you know definitively if Arceus is smiling upon you, or if you've been cursed by the gacha gods.

---

## ✨ Features

- **Live Expansion Tracking**: Supports all official expansions, dynamically adjusting the math engine for varying pack sub-rates (e.g., *Genetic Apex* vs *Mega Rising*).
- **Client-Side Speed**: 100% mathematical processing done right in your browser. No backend delays, zero loading screens.
- **Professor's Evaluation**: Get a personalized luck score (out of 10) evaluating the raw probability of your pulls.
- **Apple-Grade Aesthetic**: Built from the ground up with high-end glassmorphism styling, native fluid animations, and pixel-perfect rarity icons derived directly from in-game assets.
- **Dynamic Archives**: Browse a digital Pokédex-style archive of all tracked booster packs and analyze odds individually.

---

## 📂 Project Structure

A clean, modularized React structure:

```text
├── public/                # Static assets (Not bundled)
│   ├── images/            # Showcase images, logos, UI assets
│   ├── icons/             # ♢ ☆ ✨ 👑 Rarity symbol SVGs & PNGs
│   └── packs/             # High-res booster pack box art
├── src/                   # Application source code
│   ├── App.jsx            # Main view router & UI orchestration
│   ├── index.css          # Global styling, tokens, animations
│   ├── math.js            # Probability engine & Z-Score algorithm
│   └── data.js            # Expansion database & pack configurations
├── index.html             # Entry point
└── package.json           # Dependencies
```

---

## 📊 Tracked Rarities & Rates

The application maps exact expected values using standard and expansion-specific drop tables. Here is a snapshot of the primary global pool configuration:

| Rarity Level | Icon | Pull Weight / Odds |
| :--- | :---: | :--- |
| **Crown Rare** | 👑 | `~0.012%` |
| **3-Star Immersive** | ☆☆☆ | `~0.222%` |
| **2-Star Special Art** | ☆☆ | `~0.500%` |
| **1-Star Illustration Rare** | ☆ | `~1.111%` |
| **4-Diamond ex** | ♢♢♢♢ | `~1.666%` |
| **2-Shiny Double Shiny** | ✨✨ | `~0.100%` (Shiny packs only) |
| **1-Shiny Shiny Rare** | ✨ | `~0.300%` (Shiny packs only) |

*(Note: Actual calculated odds dynamically adjust if the selected expansion has a Shiny Slot 6 trigger).*

---

## 🚀 Getting Started

To run this application locally:

1. **Clone the repository**
   ```bash
   git clone https://github.com/JashDoshi777/PokemonTCGP-luck-calculator.git
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Start the development server**
   ```bash
   npm run dev
   ```

## 🛠️ Technology Stack
- **Framework**: React 18 / Vite
- **Animations**: GSAP (GreenSock) & CSS Keyframes
- **Styling**: Pure CSS / Glassmorphism
- **Math**: Custom statistical variance model

---
<div align="center">
  <i>"No more guessing. No more myths. Decode the exact mathematical standings of the entire global playerbase."</i>
</div>
