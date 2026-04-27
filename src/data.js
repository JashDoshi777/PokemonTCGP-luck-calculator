// Pokemon TCG Pocket - Data & Constants

export const PACKS = [
  {id:'genetic',    name:'Genetic Apex',        date:'Oct 2024', hasShiny:false, packs:3,
   pool:{crown:3, star3:3, star2:29, star1:24, d4:15}},
  {id:'mythical',   name:'Mythical Island',      date:'Dec 2024', hasShiny:false, packs:1,
   pool:{crown:1, star3:1, star2:10, star1:6, d4:5}},
  {id:'spacetime',  name:'Space-Time Smackdown', date:'Jan 2025', hasShiny:false, packs:2,
   pool:{crown:2, star3:2, star2:24, star1:24, d4:10}},
  {id:'triumphant', name:'Triumphant Light',     date:'Feb 2025', hasShiny:false, packs:1,
   pool:{crown:1, star3:1, star2:13, star1:6, d4:5}},
  {id:'shining',    name:'Shining Revelry',      date:'Mar 2025', hasShiny:true, packs:1,
   pool:{crown:1, star3:1, star2:18, star1:5, d4:9, s2:4, s1:10}},
  {id:'celestial',  name:'Celestial Guardians',  date:'Apr 2025', hasShiny:true, packs:2,
   pool:{crown:2, star3:2, star2:28, star1:24, d4:10, s2:8, s1:20}},
  {id:'extradim',   name:'Extradim. Crisis',     date:'May 2025', hasShiny:true, packs:1,
   pool:{crown:1, star3:1, star2:12, star1:6, d4:5, s2:4, s1:10}},
  {id:'eevee',      name:'Eevee Grove',          date:'Jun 2025', hasShiny:true, packs:1,
   pool:{crown:1, star3:1, star2:13, star1:9, d4:6, s2:4, s1:10}},
  {id:'wisdom',     name:'Wisdom Sea & Sky',     date:'Jul 2025', hasShiny:true, packs:2,
   pool:{crown:2, star3:2, star2:24, star1:24, d4:10, s2:8, s1:20}},
  {id:'secluded',   name:'Secluded Springs',     date:'Aug 2025', hasShiny:true, packs:1,
   pool:{crown:1, star3:1, star2:12, star1:6, d4:5, s2:4, s1:10}},
  {id:'deluxe',     name:'Deluxe Pack ex',       date:'Sep 2025', hasShiny:true, packs:1,
   pool:{crown:1, star3:1, star2:16, star1:6, d4:75, s2:2, s1:0}},
  {id:'mega',       name:'Mega Rising',          date:'Oct 2025', hasShiny:true, shinySlot6:true, packs:3,
   pool:{crown:3, star3:3, star2:30, star1:27, d4:15, s2:9, s1:33}},
  {id:'crimson',    name:'Crimson Blaze',        date:'Dec 2025', hasShiny:true, shinySlot6:true, packs:1,
   pool:{crown:2, star3:1, star2:11, star1:6, d4:5, s2:4, s1:10}},
  {id:'fantastical',name:'Fantastical Parade',   date:'Jan 2026', hasShiny:true, shinySlot6:true, packs:1,
   pool:{crown:2, star3:3, star2:23, star1:24, d4:10, s2:8, s1:20}},
  {id:'megashine',  name:'Mega Shine',           date:'Mar 2026', hasShiny:true, shinySlot6:true, packs:1,
   pool:{crown:2, star3:2, star2:9, star1:6, d4:5, s2:5, s1:24}},
  {id:'pulsing',    name:'Pulsing Aura',         date:'Apr 2026', hasShiny:true, shinySlot6:true, packs:1, preliminary:true,
   pool:{crown:2, star3:2, star2:11, star1:6, d4:5, s2:4, s1:10}},
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
  crown: `<svg width="24" height="17" viewBox="0 0 24 17" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 15.5 L4.5 5.5 L9 11 L12 2 L15 11 L19.5 5.5 L22.5 15.5 Z" fill="#d4920c" stroke="#a06808" stroke-width="0.8" stroke-linejoin="round"/>
    <rect x="1.5" y="14" width="21" height="2.5" rx="1" fill="#d4920c"/>
  </svg>`,
  '3star': `<svg width="40" height="14" viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M7,1L8.3,4.8L12.5,4.8L9.1,7.3L10.4,11.1L7,8.6L3.6,11.1L4.9,7.3L1.5,4.8L5.7,4.8Z" fill="#8b35cc"/>
    <path d="M20,1L21.3,4.8L25.5,4.8L22.1,7.3L23.4,11.1L20,8.6L16.6,11.1L17.9,7.3L14.5,4.8L18.7,4.8Z" fill="#8b35cc"/>
    <path d="M33,1L34.3,4.8L38.5,4.8L35.1,7.3L36.4,11.1L33,8.6L29.6,11.1L30.9,7.3L27.5,4.8L31.7,4.8Z" fill="#8b35cc"/>
  </svg>`,
  '2star': `<svg width="28" height="14" viewBox="0 0 28 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M7,1L8.3,4.8L12.5,4.8L9.1,7.3L10.4,11.1L7,8.6L3.6,11.1L4.9,7.3L1.5,4.8L5.7,4.8Z" fill="#1a5fd4"/>
    <path d="M21,1L22.3,4.8L26.5,4.8L23.1,7.3L24.4,11.1L21,8.6L17.6,11.1L18.9,7.3L15.5,4.8L19.7,4.8Z" fill="#1a5fd4"/>
  </svg>`,
  '1star': `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M7,1L8.3,4.8L12.5,4.8L9.1,7.3L10.4,11.1L7,8.6L3.6,11.1L4.9,7.3L1.5,4.8L5.7,4.8Z" fill="#0e8fa0"/>
  </svg>`,
  '4d': `<svg width="42" height="14" viewBox="0 0 42 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.5,1L10,7L5.5,13L1,7Z" fill="#2a9060"/>
    <path d="M16.5,1L21,7L16.5,13L12,7Z" fill="#2a9060"/>
    <path d="M27.5,1L32,7L27.5,13L23,7Z" fill="#2a9060"/>
    <path d="M38.5,1L43,7L38.5,13L34,7Z" fill="#2a9060"/>
  </svg>`,
  s2: `<svg width="32" height="14" viewBox="0 0 32 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M8,0.5L9.2,4.6L13.1,2.7L11.2,6.6L15.3,7.8L11.2,9L13.1,12.9L9.2,11L8,15.1L6.8,11L2.9,12.9L4.8,9L0.9,7.8L4.8,6.6L2.9,2.7L6.8,4.6Z" fill="#ffc107"/>
  </svg>`,
  s1: `<svg width="16" height="14" viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg">
    <path d="M8,0.5L9.2,4.6L13.1,2.7L11.2,6.6L15.3,7.8L11.2,9L13.1,12.9L9.2,11L8,15.1L6.8,11L2.9,12.9L4.8,9L0.9,7.8L4.8,6.6L2.9,2.7L6.8,4.6Z" fill="#ffc107"/>
  </svg>`,
  god: `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="9" r="8" fill="none" stroke="#7c3aed" stroke-width="1.5"/>
  </svg>`,
};

export const RARITIES = [
  {id:'crown', name:'Crown Rare',               key:'crown', weight:500, icon:ICONS.crown},
  {id:'3star', name:'3-Star Immersive',          key:'star3', weight:350, icon:ICONS['3star']},
  {id:'2star', name:'2-Star Special Art',        key:'star2', weight:120, icon:ICONS['2star']},
  {id:'1star', name:'1-Star Illustration Rare',  key:'star1', weight:80,  icon:ICONS['1star']},
  {id:'4d',    name:'4-Diamond ex',              key:'d4',    weight:50,  icon:ICONS['4d']},
  {id:'s2',    name:'2-Shiny Double Shiny',      key:'s2',    weight:200, icon:ICONS.s2,  shinyOnly:true},
  {id:'s1',    name:'1-Shiny Shiny Rare',        key:'s1',    weight:130, icon:ICONS.s1,  shinyOnly:true},
];
