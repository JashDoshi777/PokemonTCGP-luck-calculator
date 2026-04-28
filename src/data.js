// Pokemon TCG Pocket - Data & Constants

export const PACKS = [
  {id:'genetic',    name:'Genetic Apex',        date:'Oct 2024', hasShiny:false, packs:3,
   img:'/packs/genetic_apex.jpg', pool:{crown:3, star3:3, star2:29, star1:24, d4:15}},
  {id:'mythical',   name:'Mythical Island',      date:'Dec 2024', hasShiny:false, packs:1,
   img:'/packs/mythical_island.jpg', pool:{crown:1, star3:1, star2:10, star1:6, d4:5}},
  {id:'spacetime',  name:'Space-Time Smackdown', date:'Jan 2025', hasShiny:false, packs:2,
   img:'/packs/space_time_smackdown.jpg', pool:{crown:2, star3:2, star2:24, star1:24, d4:10}},
  {id:'triumphant', name:'Triumphant Light',     date:'Feb 2025', hasShiny:false, packs:1,
   img:'/packs/triumphant_light.jpg', pool:{crown:1, star3:1, star2:13, star1:6, d4:5}},
  {id:'shining',    name:'Shining Revelry',      date:'Mar 2025', hasShiny:true, packs:1,
   img:'/packs/shining_revelry.jpg', pool:{crown:1, star3:1, star2:18, star1:5, d4:9, s2:4, s1:10}},
  {id:'celestial',  name:'Celestial Guardians',  date:'Apr 2025', hasShiny:true, packs:2,
   img:'/packs/celestial_guradian.jpg', pool:{crown:2, star3:2, star2:28, star1:24, d4:10, s2:8, s1:20}},
  {id:'extradim',   name:'Extradim. Crisis',     date:'May 2025', hasShiny:true, packs:1,
   img:'/packs/extradimensional_crisis.jpg', pool:{crown:1, star3:1, star2:12, star1:6, d4:5, s2:4, s1:10}},
  {id:'eevee',      name:'Eevee Grove',          date:'Jun 2025', hasShiny:true, packs:1,
   img:'/packs/eevee_grove.jpg', pool:{crown:1, star3:1, star2:13, star1:9, d4:6, s2:4, s1:10}},
  {id:'wisdom',     name:'Wisdom Sea & Sky',     date:'Jul 2025', hasShiny:true, packs:2,
   img:'/packs/wisdom_of_sea_and_sky.jpg', pool:{crown:2, star3:2, star2:24, star1:24, d4:10, s2:8, s1:20}},
  {id:'secluded',   name:'Secluded Springs',     date:'Aug 2025', hasShiny:true, packs:1,
   img:'/packs/secluded_srings.jpg', pool:{crown:1, star3:1, star2:12, star1:6, d4:5, s2:4, s1:10}},
  {id:'deluxe',     name:'Deluxe Pack ex',       date:'Sep 2025', hasShiny:false, packs:1,
   img:'/packs/deluxe_pack_ex.jpg', pool:{crown:1, star3:1, star2:16, star1:6, d4:75}},
  {id:'mega',       name:'Mega Rising',          date:'Oct 2025', hasShiny:true, shinySlot6:true, packs:3,
   img:'/packs/mega_rising.jpg', pool:{crown:3, star3:3, star2:30, star1:27, d4:15, s2:9, s1:33}},
  {id:'crimson',    name:'Crimson Blaze',        date:'Dec 2025', hasShiny:true, shinySlot6:true, packs:1,
   img:'/packs/crimson_blaze.jpg', pool:{crown:2, star3:1, star2:11, star1:6, d4:5, s2:4, s1:10}},
  {id:'fantastical',name:'Fantastical Parade',   date:'Jan 2026', hasShiny:true, shinySlot6:true, packs:1,
   img:'/packs/fantastical_parade.jpg', pool:{crown:2, star3:3, star2:23, star1:24, d4:10, s2:8, s1:20}},
  {id:'megashine',  name:'Mega Shine',           date:'Mar 2026', hasShiny:true, shinySlot6:true, packs:1,
   img:'/packs/mega shine.jpg', pool:{crown:2, star3:2, star2:9, star1:6, d4:5, s2:5, s1:24}},
  {id:'pulsing',    name:'Pulsing Aura',         date:'Apr 2026', hasShiny:true, shinySlot6:true, packs:1, preliminary:true,
   img:'/packs/pulsing aura.jpg', pool:{crown:2, star3:2, star2:11, star1:6, d4:5, s2:4, s1:10}},
];

export const BASE_RATES = {
  crown: 0.002000,
  star3: 0.011100,
  star2: 0.025000,
  star1: 0.128600,
  d4:    0.083300,
  s2:    0.016660,
  s1:    0.035710,
};

// Expected hits per pack for 4-card Deluxe Pack ex (Slot 4 is guaranteed 4-diamond or higher)
export const DELUXE_RATES = {
  crown: 0.005000,
  star3: 0.012000,
  star2: 0.035000,
  star1: 0.025000,
  d4:    0.966000,
};

export const BASE_RATES_SLOT6 = {
  s1: 0.005454,
  s2: 0.006364,
};

export const SHINY_SETS_PRE_B1 = 7;
export const SHINY_SETS_B1PLUS = 5;
export const SHINY_OVERALL_BLEND = {
  s1: (SHINY_SETS_PRE_B1 * BASE_RATES.s1 + SHINY_SETS_B1PLUS * BASE_RATES_SLOT6.s1) / (SHINY_SETS_PRE_B1 + SHINY_SETS_B1PLUS),
  s2: (SHINY_SETS_PRE_B1 * BASE_RATES.s2 + SHINY_SETS_B1PLUS * BASE_RATES_SLOT6.s2) / (SHINY_SETS_PRE_B1 + SHINY_SETS_B1PLUS),
};

export const GOD_RATE = 0.0005;
export const SHINY_GOD_RATE = 0.00005; // 1 in 20,000 for Mega Shine "Themed Rare Pack"

export const SLOT_RATES = {
  crown: {desc:'slot 4: 0.040% · slot 5: 0.160%'},
  star3: {desc:'slot 4: 0.220% · slot 5: 0.890%'},
  star2: {desc:'slot 4: 0.500% · slot 5: 2.000%'},
  star1: {desc:'slot 4: 2.572% · slot 5: 10.288%'},
  d4:    {desc:'slot 4: 1.666% · slot 5: 6.664%'},
  s2_pre: {desc:'slot 4: 0.333% · slot 5: 1.333%'},
  s1_pre: {desc:'slot 4: 0.714% · slot 5: 2.857%'},
  s2_b1:  {desc:'slot 6 of 6-card pack (8% chance)'},
  s1_b1:  {desc:'slot 6 of 6-card pack (8% chance)'},
};

export const ICONS = {
  crown: `<img src="/icons/crown.png" alt="Crown" style="height: 24px; object-fit: contain;" />`,
  '3star': `<div style="display: flex; gap: 2px;">
    <img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />
    <img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />
    <img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />
  </div>`,
  '2star': `<div style="display: flex; gap: 2px;">
    <img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />
    <img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />
  </div>`,
  '1star': `<img src="/icons/star.png" alt="Star" style="height: 18px; object-fit: contain;" />`,
  '4d': `<div style="display: flex; gap: 1px;">
    <img src="/icons/diamond.png" alt="Diamond" style="height: 15px; object-fit: contain;" />
    <img src="/icons/diamond.png" alt="Diamond" style="height: 15px; object-fit: contain;" />
    <img src="/icons/diamond.png" alt="Diamond" style="height: 15px; object-fit: contain;" />
    <img src="/icons/diamond.png" alt="Diamond" style="height: 15px; object-fit: contain;" />
  </div>`,
  s2: `<div style="display: flex; gap: 4px;">
    <img src="/icons/shiny.png" alt="Shiny" style="height: 20px; object-fit: contain;" />
    <img src="/icons/shiny.png" alt="Shiny" style="height: 20px; object-fit: contain;" />
  </div>`,
  s1: `<img src="/icons/shiny.png" alt="Shiny" style="height: 20px; object-fit: contain;" />`,
  god: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff0000" />
        <stop offset="20%" stop-color="#ffff00" />
        <stop offset="40%" stop-color="#00ff00" />
        <stop offset="60%" stop-color="#00ffff" />
        <stop offset="80%" stop-color="#0000ff" />
        <stop offset="100%" stop-color="#ff00ff" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#rainbow)" stroke="#333" stroke-width="1.5"/>
    <path d="M 2 12 A 10 10 0 0 0 22 12 Z" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <line x1="2" y1="12" x2="22" y2="12" stroke="#333" stroke-width="2"/>
    <circle cx="12" cy="12" r="4" fill="#fff" stroke="#333" stroke-width="2"/>
    <circle cx="12" cy="12" r="1.5" fill="#333"/>
  </svg>`,
};

export const RARITIES = [
  {id:'crown', name:'Crown Rare',               key:'crown', weight:500, icon:ICONS.crown},
  {id:'3star', name:'3-Star Immersive',          key:'star3', weight:350, icon:ICONS['3star']},
  {id:'2star', name:'2-Star Special Art',        key:'star2', weight:120, icon:ICONS['2star']},
  {id:'1star', name:'1-Star Illustration Rare',  key:'star1', weight:80,  icon:ICONS['1star']},
  {id:'4d',    name:'4-Diamond ex',              key:'d4',    weight:50,  icon:ICONS['4d']},
  {id:'s2',    name:'2-star Shiny',      key:'s2',    weight:200, icon:ICONS.s2,  shinyOnly:true},
  {id:'s1',    name:'1-star Shiny',        key:'s1',    weight:130, icon:ICONS.s1,  shinyOnly:true},
];
