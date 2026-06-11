import fs from 'fs'; import fetch from 'node-fetch';
const mapping = { 'grass': 'Grass', 'bug': 'Grass', 'fire': 'Fire', 'water': 'Water', 'ice': 'Water', 'electric': 'Lightning', 'psychic': 'Psychic', 'fairy': 'Psychic', 'fighting': 'Fighting', 'rock': 'Fighting', 'ground': 'Fighting', 'dark': 'Darkness', 'poison': 'Darkness', 'ghost': 'Darkness', 'steel': 'Metal', 'dragon': 'Dragon', 'normal': 'Colorless', 'flying': 'Colorless' };
async function run() {
  const r1 = await fetch('https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist/cards.json');
  const cards = await r1.json();
  const currentMap = JSON.parse(fs.readFileSync('src/data/energy_mapping.json'));
  
  let added = 0;
  for(let c of cards) {
    if (currentMap[c.name]) continue;
    let n = c.name.toLowerCase().replace(/ ex$/, '').replace(/ v$/, '').replace(/ vmax$/, '').replace(/ vstar$/, '').replace(/’/g, '').split(' ')[0];
    if (n === 'mr.') n = 'mr-mime';
    if (n === 'farfetchd') n = 'farfetchd';
    try {
      const p = await fetch('https://pokeapi.co/api/v2/pokemon/'+n);
      if(!p.ok) continue;
      const d = await p.json();
      const t = d.types[0].type.name;
      if(mapping[t]) {
        currentMap[c.name] = mapping[t];
        added++;
      }
    } catch(e) {}
  }
  fs.writeFileSync('src/data/energy_mapping.json', JSON.stringify(currentMap, null, 2));
  console.log('Added', added, 'new mappings. Total:', Object.keys(currentMap).length);
}
run();

