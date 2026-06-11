import fs from 'fs';
const mapping = { 'Grass': 'Grass', 'Bug': 'Grass', 'Fire': 'Fire', 'Water': 'Water', 'Ice': 'Water', 'Electric': 'Lightning', 'Psychic': 'Psychic', 'Fairy': 'Psychic', 'Fighting': 'Fighting', 'Rock': 'Fighting', 'Ground': 'Fighting', 'Dark': 'Darkness', 'Poison': 'Darkness', 'Ghost': 'Darkness', 'Steel': 'Metal', 'Dragon': 'Dragon', 'Normal': 'Colorless', 'Flying': 'Colorless' };
async function run() {
  const r1 = await fetch('https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist/cards.json');
  const cards = await r1.json();
  const r2 = await fetch('https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json');
  const pokedex = await r2.json();
  
  const dexMap = {};
  for (let p of pokedex) {
    dexMap[p.name.english.toLowerCase()] = p.type[0];
  }
  // Add some gen 8/9 manual entries or specific edge cases just in case
  dexMap['meltan'] = 'Steel'; dexMap['melmetal'] = 'Steel';
  
  const res = {};
  for(let c of cards) {
    let cleanName = c.name.toLowerCase().replace(/ ex$/, '').replace(/ v$/, '').replace(/ vmax$/, '').replace(/ vstar$/, '').split(' ')[0];
    if (cleanName === 'mr.') cleanName = 'mr. mime';
    let type = dexMap[cleanName];
    if (type && mapping[type]) {
      res[c.name] = mapping[type];
    }
  }
  fs.writeFileSync('src/data/energy_mapping.json', JSON.stringify(res, null, 2));
  console.log('Mapped', Object.keys(res).length, 'cards.');
}
run();

