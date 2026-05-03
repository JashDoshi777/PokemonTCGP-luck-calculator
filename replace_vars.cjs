const fs = require('fs');
const path = require('path');

const cssFiles = [
  'src/index.css',
  'src/pages/DeckBuilder.css',
  'src/pages/CollectionTracker.css',
  'src/pages/MetaDecks.css',
  'src/components/LoginModal.css',
  'src/components/PokemonCard.css'
];

const replacements = [
  { search: /#fdfbfb/g, replace: 'var(--bg-body)' },
  { search: /rgba\(255, 255, 255, 0\.65\)/g, replace: 'var(--glass-panel-bg)' },
  { search: /rgba\(255, 255, 255, 0\.8\)/g, replace: 'var(--glass-panel-border)' },
  { search: /0 20px 60px rgba\(0,0,0,0\.05\), inset 0 1px 0 rgba\(255,255,255,1\)/g, replace: 'var(--glass-panel-shadow)' },
  { search: /linear-gradient\(90deg, rgba\(255,255,255,0\) 0%, rgba\(255,255,255,1\) 50%, rgba\(255,255,255,0\) 100%\)/g, replace: 'var(--glass-panel-divider)' },
  
  { search: /rgba\(255, 255, 255, 0\.5\)/g, replace: 'var(--glass-card-bg)' },
  { search: /rgba\(255, 255, 255, 0\.6\)/g, replace: 'var(--glass-card-border)' },
  { search: /0 10px 30px rgba\(0,0,0,0\.04\), inset 0 1px 0 rgba\(255,255,255,0\.8\)/g, replace: 'var(--glass-card-shadow)' },
  
  { search: /rgba\(240, 240, 245, 0\.65\)/g, replace: 'var(--nav-bg)' },
  { search: /rgba\(255, 255, 255, 0\.3\)/g, replace: 'var(--nav-border)' },
  { search: /0 10px 40px rgba\(0,0,0,0\.1\), inset 0 1px 1px rgba\(255,255,255,0\.8\)/g, replace: 'var(--nav-shadow)' },

  { search: /rgba\(255,255,255,0\.7\)/g, replace: 'var(--stepper-bg)' },
  { search: /rgba\(0,0,0,0\.05\)/g, replace: 'var(--border-subtle)' },
  { search: /inset 0 2px 4px rgba\(0,0,0,0\.02\)/g, replace: 'var(--stepper-shadow)' },

  { search: /#f2f2f7/g, replace: 'var(--ios-sheet-bg)' },
  { search: /rgba\(242, 242, 247, 0\.85\)/g, replace: 'var(--ios-sheet-header)' },
  { search: /rgba\(0,0,0,0\.08\)/g, replace: 'var(--ios-sheet-border)' },

  { search: /rgba\(0, 0, 0, 0\.03\)/g, replace: 'var(--input-bg)' },
  { search: /rgba\(0,0,0,0\.03\)/g, replace: 'var(--input-bg)' },
  { search: /rgba\(0, 0, 0, 0\.1\)/g, replace: 'var(--border-medium)' },
  { search: /rgba\(0,0,0,0\.1\)/g, replace: 'var(--border-medium)' },
  
  { search: /rgba\(0, 0, 0, 0\.04\)/g, replace: 'var(--nav-pill-hover-bg)' },
  { search: /rgba\(0,0,0,0\.04\)/g, replace: 'var(--nav-pill-hover-bg)' },

  // Special text gradient
  { search: /linear-gradient\(135deg, #1d1d1f 0%, #434353 100%\)/g, replace: 'linear-gradient(135deg, var(--text-gradient-start) 0%, var(--text-gradient-end) 100%)' },
  { search: /linear-gradient\(135deg, #FF3B30 0%, #FF9500 100%\)/g, replace: 'linear-gradient(135deg, var(--text-gradient-red-start) 0%, var(--text-gradient-red-end) 100%)' }
];

cssFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  replacements.forEach(r => {
    content = content.replace(r.search, r.replace);
  });
  
  // Specific replacements for App.jsx later, just doing CSS first
  fs.writeFileSync(filePath, content);
  console.log('Updated ' + file);
});
