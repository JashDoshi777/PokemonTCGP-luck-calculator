import fs from 'fs'; import fetch from 'node-fetch';
const mapping = { 'grass': 'Grass', 'bug': 'Grass', 'fire': 'Fire', 'water': 'Water', 'ice': 'Water', 'electric': 'Lightning', 'psychic': 'Psychic', 'fairy': 'Psychic', 'fighting': 'Fighting', 'rock': 'Fighting', 'ground': 'Fighting', 'dark': 'Darkness', 'poison': 'Darkness', 'ghost': 'Darkness', 'steel': 'Metal', 'dragon': 'Dragon', 'normal': 'Colorless', 'flying': 'Colorless' };
async function run() {
  const r1 = await fetch('https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist/cards.json');
  const cards = await r1.json();
  const currentMap = JSON.parse(fs.readFileSync('src/data/energy_mapping.json', 'utf8'));
  
  const uniqueUnmapped = new Set();
  for(let c of cards) {
    if (!currentMap[c.name]) uniqueUnmapped.add(c.name);
  }
  
  console.log('Unmapped unique names:', uniqueUnmapped.size);
  let added = 0;
  for(let name of uniqueUnmapped) {
    // skip obvious trainers
    if (name.match(/(Poké|Research|Fossil|Pokedex|Amber|Ticket|Potion|Heal|Speed|Scope|Badge|Card|Berry)/i)) continue;
    
    let n = name.toLowerCase().replace(/ ex$/, '').replace(/ v$/, '').replace(/ vmax$/, '').replace(/ vstar$/, '').replace(/’/g, '').replace(/[^a-z-]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '');
    if (n === 'mr') n = 'mr-mime';
    if (n === 'farfetchd') n = 'farfetchd';
    if (n === 'nidoran') n = 'nidoran-m'; // generic fallback
    if (n === 'mime-jr') n = 'mime-jr';
    if (n === 'type-null') n = 'type-null';
    if (n === 'ho-oh') n = 'ho-oh';
    if (n === 'porygon-z') n = 'porygon-z';
    
    try {
      const p = await fetch('https://pokeapi.co/api/v2/pokemon/'+n);
      if(p.ok) {
        const d = await p.json();
        const t = d.types[0].type.name;
        if(mapping[t]) {
          currentMap[name] = mapping[t];
          added++;
        }
      }
    } catch(e) {}
  }
  fs.writeFileSync('src/data/energy_mapping.json', JSON.stringify(currentMap, null, 2));
  console.log('Added', added, 'new mappings. Total keys:', Object.keys(currentMap).length);
}
run();

