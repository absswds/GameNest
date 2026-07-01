const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'assets', 'game-covers');

const covers = [
  { id: 'tictactoe', title: 'Tic-Tac-Toe', subtitle: 'Quick duel', badge: 'XO', category: 'Classic', palette: ['#f6efe3', '#e8c39a', '#c67c4b', '#2b2118'], motif: 'grid' },
  { id: 'gomoku', title: 'Gomoku', subtitle: 'Five in a row', badge: '5', category: 'Classic', palette: ['#f3efe7', '#c6ab7a', '#8a5a2a', '#21170f'], motif: 'stones' },
  { id: 'davinci', title: 'Davinci Code', subtitle: 'Logic and hidden tiles', badge: 'DC', category: 'Puzzle', palette: ['#f7f2ea', '#6fa6b9', '#315c73', '#1a2430'], motif: 'tiles' },
  { id: 'uno', title: 'UNO', subtitle: 'Color match', badge: 'UNO', category: 'Party', palette: ['#f9efe8', '#ef5a45', '#f2b441', '#271510'], motif: 'cards' },
  { id: 'doudizhu', title: 'Landlord', subtitle: 'Three player poker', badge: 'L3', category: 'Cards', palette: ['#f7f0e6', '#b94f43', '#d0a35f', '#261712'], motif: 'fan' },
  { id: 'exploding-kittens', title: 'Exploding Kittens', subtitle: 'Risky draw', badge: 'EK', category: 'Party', palette: ['#f8efe7', '#ff8d5c', '#5d3a32', '#271311'], motif: 'burst' },
  { id: 'rummikub', title: 'Rummikub', subtitle: 'Rebuild the table', badge: 'RK', category: 'Strategy', palette: ['#f6f0e5', '#7ba9a0', '#d2573d', '#1c2a2e'], motif: 'racks' },
  { id: 'twentyfour', title: '24 Points', subtitle: 'Math race', badge: '24', category: 'Brain', palette: ['#f6f1e8', '#4d8ec6', '#f2c84b', '#182432'], motif: 'numbers' },
  { id: 'minesweeper', title: 'Minesweeper', subtitle: 'Same map sprint', badge: 'MS', category: 'Brain', palette: ['#eef4f0', '#7a9c87', '#2f5446', '#18231f'], motif: 'mines' },
  { id: 'numberbomb', title: 'Number Bomb', subtitle: 'Narrow the range', badge: 'NB', category: 'Party', palette: ['#f8efe5', '#ef8651', '#b83f34', '#261714'], motif: 'range' },
  { id: 'oldmaid', title: 'Old Maid', subtitle: 'Avoid the odd card', badge: 'OM', category: 'Cards', palette: ['#f6edf1', '#b57bb0', '#70406f', '#261724'], motif: 'rings' },
  { id: 'liarsbar', title: "Liar's Bar", subtitle: 'Bluff and challenge', badge: 'LB', category: 'Mind Game', palette: ['#f4efe8', '#6b513f', '#c8a45c', '#1f1712'], motif: 'glasses' },
  { id: 'bigtwo', title: 'Big Two', subtitle: 'Fast hand control', badge: 'B2', category: 'Cards', palette: ['#f6f0e6', '#4c82b2', '#1d3958', '#121c28'], motif: 'stack' },
  { id: 'texas', title: "Texas Hold'em", subtitle: 'Read the table', badge: 'A', category: 'Cards', palette: ['#f4eee7', '#2f6f5b', '#d8b168', '#13211d'], motif: 'chips' },
  { id: 'flightchess', title: 'Flight Chess', subtitle: 'Race home', badge: 'FC', category: 'Family', palette: ['#f7efe6', '#62a7cf', '#efc34a', '#1d3550'], motif: 'planes' },
  { id: 'snakebattle', title: 'Snake Battle', subtitle: 'Realtime arena', badge: 'SB', category: 'Arcade', palette: ['#eef5ec', '#65a15e', '#29553e', '#14211a'], motif: 'snake' },
  { id: 'chinesechess', title: 'Chinese Chess', subtitle: 'Board tactics', badge: 'CC', category: 'Classic', palette: ['#f5ede3', '#c26d53', '#8d4532', '#281511'], motif: 'cross' },
  { id: 'go9', title: 'Go 9x9', subtitle: 'Compact territory', badge: 'GO', category: 'Classic', palette: ['#f2eee7', '#a78658', '#3a2a17', '#15100b'], motif: 'go' },
  { id: 'monopoly', title: 'Monopoly', subtitle: 'Build the city', badge: 'M', category: 'Strategy', palette: ['#f7f1e5', '#d4b070', '#4d7e8b', '#1d2228'], motif: 'city' },
  { id: 'suikabattle', title: 'Fruit Merge', subtitle: 'Drop and combine', badge: 'FM', category: 'Arcade', palette: ['#f8f1e6', '#e39b4e', '#c84f45', '#23160f'], motif: 'fruit' },
  { id: 'sheeptile', title: 'Sheep Tile', subtitle: 'Layered triple match', badge: 'ST', category: 'Puzzle', palette: ['#f0f2e8', '#86a56d', '#52754f', '#182017'], motif: 'sheep' },
  { id: 'drawguess', title: 'Draw Guess', subtitle: 'Sketch and laugh', badge: 'DG', category: 'Party', palette: ['#f7f0ea', '#c27a57', '#8c5474', '#24181d'], motif: 'sketch' },
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function patternFor(cover) {
  const accent = cover.palette[2];
  const dark = cover.palette[3];

  switch (cover.motif) {
    case 'grid':
      return `
        <g opacity="0.9">
          <path d="M1040 292h240M1040 412h240M1120 212v280M1200 212v280" stroke="${accent}" stroke-width="28" stroke-linecap="round"/>
          <path d="M1100 730l120 120M1220 730l-120 120" stroke="${dark}" stroke-width="28" stroke-linecap="round"/>
          <circle cx="1040" cy="790" r="76" fill="none" stroke="${accent}" stroke-width="26"/>
        </g>`;
    case 'stones':
      return `
        <g opacity="0.95">
          <path d="M1010 280c120 0 250 95 310 220" stroke="${accent}" stroke-width="24" stroke-linecap="round" fill="none"/>
          <path d="M1080 250c90 0 190 70 240 170" stroke="${dark}" stroke-width="18" stroke-linecap="round" fill="none" opacity="0.45"/>
          <circle cx="1050" cy="760" r="68" fill="${dark}"/>
          <circle cx="1175" cy="640" r="68" fill="#fff8ef" stroke="${accent}" stroke-width="16"/>
          <circle cx="1290" cy="840" r="68" fill="${dark}"/>
        </g>`;
    case 'tiles':
      return `
        <g opacity="0.95">
          <rect x="1025" y="285" width="130" height="190" rx="24" fill="#fff8ef" stroke="${accent}" stroke-width="12"/>
          <rect x="1168" y="350" width="130" height="190" rx="24" fill="${accent}" opacity="0.88"/>
          <rect x="1085" y="535" width="130" height="190" rx="24" fill="${dark}" opacity="0.92"/>
          <rect x="1230" y="595" width="130" height="190" rx="24" fill="#fff8ef" stroke="${dark}" stroke-width="12"/>
        </g>`;
    case 'cards':
      return `
        <g opacity="0.96">
          <rect x="1015" y="315" width="160" height="240" rx="24" fill="#ef5a45"/>
          <rect x="1115" y="265" width="160" height="240" rx="24" fill="#f2b441"/>
          <rect x="1215" y="315" width="160" height="240" rx="24" fill="#3c79d6"/>
          <rect x="1115" y="555" width="160" height="240" rx="24" fill="#59a76b"/>
        </g>`;
    case 'fan':
      return `
        <g opacity="0.96">
          <rect x="1060" y="270" width="120" height="220" rx="20" fill="#fff9ef" transform="rotate(-18 1120 380)"/>
          <rect x="1130" y="260" width="120" height="220" rx="20" fill="#fff9ef" transform="rotate(-6 1190 370)"/>
          <rect x="1200" y="275" width="120" height="220" rx="20" fill="#fff9ef" transform="rotate(8 1260 385)"/>
          <rect x="1270" y="320" width="120" height="220" rx="20" fill="#fff9ef" transform="rotate(20 1330 430)"/>
          <circle cx="1130" cy="380" r="22" fill="${accent}"/>
          <circle cx="1250" cy="370" r="22" fill="${dark}"/>
        </g>`;
    case 'burst':
      return `
        <g opacity="0.96">
          <path d="M1180 235l42 106 113 18-84 77 21 112-92-51-92 51 21-112-84-77 113-18z" fill="${accent}"/>
          <circle cx="1180" cy="640" r="110" fill="#fff7ee" stroke="${dark}" stroke-width="18"/>
          <path d="M1100 640h160M1180 560v160" stroke="${dark}" stroke-width="22" stroke-linecap="round"/>
        </g>`;
    case 'racks':
      return `
        <g opacity="0.96">
          <rect x="1010" y="640" width="360" height="28" rx="14" fill="${dark}"/>
          <rect x="1040" y="530" width="74" height="96" rx="14" fill="#4f87c6"/>
          <rect x="1124" y="480" width="74" height="146" rx="14" fill="#d0573f"/>
          <rect x="1208" y="430" width="74" height="196" rx="14" fill="#e0bc50"/>
          <rect x="1292" y="510" width="74" height="116" rx="14" fill="#60a376"/>
        </g>`;
    case 'numbers':
      return `
        <g opacity="0.96">
          <text x="1000" y="520" font-size="188" font-weight="800" fill="${accent}" font-family="Arial, sans-serif">3 + 5</text>
          <text x="1070" y="735" font-size="232" font-weight="800" fill="${dark}" font-family="Arial, sans-serif">24</text>
          <circle cx="1300" cy="360" r="48" fill="#fff8ee" stroke="${accent}" stroke-width="14"/>
        </g>`;
    case 'mines':
      return `
        <g opacity="0.96">
          <rect x="1015" y="280" width="330" height="330" rx="30" fill="#f8fcf8" stroke="${accent}" stroke-width="16"/>
          <path d="M1125 280v330M1235 280v330M1015 390h330M1015 500h330" stroke="${accent}" stroke-width="10" opacity="0.5"/>
          <circle cx="1180" cy="445" r="60" fill="${dark}"/>
          <path d="M1180 350v190M1085 445h190M1118 383l124 124M1242 383l-124 124" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
        </g>`;
    case 'range':
      return `
        <g opacity="0.96">
          <rect x="1020" y="340" width="340" height="28" rx="14" fill="${accent}" opacity="0.35"/>
          <rect x="1090" y="340" width="190" height="28" rx="14" fill="${accent}"/>
          <circle cx="1090" cy="354" r="26" fill="#fff8ef" stroke="${dark}" stroke-width="10"/>
          <circle cx="1280" cy="354" r="26" fill="#fff8ef" stroke="${dark}" stroke-width="10"/>
          <path d="M1180 530l40 96 102 12-76 69 20 102-86-48-86 48 20-102-76-69 102-12z" fill="${dark}"/>
        </g>`;
    case 'rings':
      return `
        <g opacity="0.96">
          <circle cx="1125" cy="420" r="92" fill="none" stroke="${accent}" stroke-width="24"/>
          <circle cx="1260" cy="570" r="92" fill="none" stroke="${dark}" stroke-width="24"/>
          <circle cx="1100" cy="760" r="92" fill="none" stroke="#fff8ef" stroke-width="24"/>
        </g>`;
    case 'glasses':
      return `
        <g opacity="0.96">
          <rect x="1040" y="300" width="96" height="190" rx="28" fill="#fff7eb" stroke="${accent}" stroke-width="12"/>
          <rect x="1170" y="250" width="96" height="240" rx="28" fill="#fff7eb" stroke="${accent}" stroke-width="12"/>
          <rect x="1300" y="330" width="96" height="160" rx="28" fill="#fff7eb" stroke="${accent}" stroke-width="12"/>
          <path d="M1005 625c80-42 166-42 246 0M1170 625c82-42 168-42 250 0" stroke="${dark}" stroke-width="18" stroke-linecap="round" fill="none"/>
        </g>`;
    case 'stack':
      return `
        <g opacity="0.96">
          <rect x="1040" y="290" width="240" height="150" rx="28" fill="#fff8ef" stroke="${accent}" stroke-width="14"/>
          <rect x="1080" y="470" width="240" height="150" rx="28" fill="#fff8ef" stroke="${accent}" stroke-width="14"/>
          <rect x="1120" y="650" width="240" height="150" rx="28" fill="#fff8ef" stroke="${accent}" stroke-width="14"/>
        </g>`;
    case 'chips':
      return `
        <g opacity="0.96">
          <circle cx="1090" cy="380" r="82" fill="#fff8ef" stroke="${accent}" stroke-width="24"/>
          <circle cx="1240" cy="520" r="82" fill="#fff8ef" stroke="${dark}" stroke-width="24"/>
          <circle cx="1140" cy="690" r="82" fill="#fff8ef" stroke="${accent}" stroke-width="24"/>
          <path d="M1010 770h330" stroke="${dark}" stroke-width="22" stroke-linecap="round"/>
        </g>`;
    case 'planes':
      return `
        <g opacity="0.96">
          <circle cx="1080" cy="355" r="48" fill="#4aa3ff"/>
          <circle cx="1245" cy="355" r="48" fill="#efc34a"/>
          <circle cx="1080" cy="520" r="48" fill="#ef6d5f"/>
          <circle cx="1245" cy="520" r="48" fill="#55b26f"/>
          <path d="M1162 262v344M990 434h344" stroke="${dark}" stroke-width="16" stroke-linecap="round"/>
          <path d="M1110 650l70-90 70 90-70 120z" fill="#fff8ef" stroke="${dark}" stroke-width="14"/>
        </g>`;
    case 'snake':
      return `
        <g opacity="0.96">
          <path d="M1010 675c60-152 246-196 334-112 64 62 40 160-62 160-72 0-110-58-110-96 0-42 34-76 74-76 38 0 62 26 62 56" stroke="${accent}" stroke-width="38" stroke-linecap="round" fill="none"/>
          <circle cx="1345" cy="556" r="24" fill="${dark}"/>
          <circle cx="1350" cy="548" r="6" fill="#fff"/>
        </g>`;
    case 'cross':
      return `
        <g opacity="0.96">
          <path d="M1015 305h330M1015 805h330M1015 305v500M1345 305v500" stroke="${accent}" stroke-width="12"/>
          <path d="M1015 555h330M1180 305v500" stroke="${accent}" stroke-width="12" opacity="0.45"/>
          <path d="M1080 390l200 330M1280 390l-200 330" stroke="${dark}" stroke-width="20" stroke-linecap="round"/>
        </g>`;
    case 'go':
      return `
        <g opacity="0.96">
          <rect x="1015" y="280" width="330" height="330" rx="30" fill="#e6c98e" stroke="${accent}" stroke-width="16"/>
          <path d="M1080 280v330M1145 280v330M1210 280v330M1275 280v330M1015 345h330M1015 410h330M1015 475h330M1015 540h330" stroke="${dark}" stroke-width="8" opacity="0.55"/>
          <circle cx="1110" cy="375" r="28" fill="${dark}"/>
          <circle cx="1245" cy="510" r="28" fill="#fff8ef" stroke="${accent}" stroke-width="10"/>
          <circle cx="1180" cy="445" r="28" fill="${dark}"/>
        </g>`;
    case 'city':
      return `
        <g opacity="0.96">
          <rect x="1030" y="700" width="320" height="120" rx="26" fill="${dark}" opacity="0.88"/>
          <rect x="1055" y="520" width="78" height="180" rx="18" fill="${accent}"/>
          <rect x="1160" y="430" width="92" height="270" rx="18" fill="#7bb0bd"/>
          <rect x="1278" y="575" width="58" height="125" rx="16" fill="#f2d395"/>
          <path d="M1095 520v-96h-32v96M1208 430v-126h-34v126" stroke="${dark}" stroke-width="14" stroke-linecap="round"/>
        </g>`;
    case 'fruit':
      return `
        <g opacity="0.96">
          <circle cx="1085" cy="640" r="72" fill="#ef6d5f"/>
          <circle cx="1235" cy="540" r="92" fill="#f2c24d"/>
          <circle cx="1290" cy="735" r="68" fill="#87c96b"/>
          <path d="M1235 448c22-34 54-52 92-52" stroke="${dark}" stroke-width="14" stroke-linecap="round"/>
        </g>`;
    case 'sheep':
      return `
        <g opacity="0.96">
          <rect x="1035" y="330" width="120" height="120" rx="24" fill="#fff8ef" stroke="${accent}" stroke-width="12"/>
          <rect x="1165" y="435" width="120" height="120" rx="24" fill="#fff8ef" stroke="${accent}" stroke-width="12"/>
          <rect x="1095" y="585" width="120" height="120" rx="24" fill="#fff8ef" stroke="${accent}" stroke-width="12"/>
          <circle cx="1320" cy="760" r="64" fill="#f7faf2" stroke="${accent}" stroke-width="12"/>
          <circle cx="1360" cy="745" r="24" fill="${dark}"/>
        </g>`;
    case 'sketch':
      return `
        <g opacity="0.96">
          <rect x="1035" y="300" width="300" height="420" rx="30" fill="#fff9ef" stroke="${accent}" stroke-width="14"/>
          <path d="M1085 395c42-48 118-54 164-8M1090 515c58-26 126-12 180 30M1098 600c44 6 82 24 124 56" stroke="${dark}" stroke-width="16" stroke-linecap="round" fill="none"/>
          <path d="M1295 785l-42-102 42-28 54 86z" fill="${accent}"/>
        </g>`;
    default:
      return '';
  }
}

function coverSvg(cover) {
  const [bgA, bgB, accent, dark] = cover.palette;
  const title = esc(cover.title);
  const subtitle = esc(cover.subtitle);
  const category = esc(cover.category.toUpperCase());
  const badge = esc(cover.badge);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgA}"/>
      <stop offset="100%" stop-color="${bgB}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.72)"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" rx="56" fill="url(#bg)"/>
  <circle cx="1240" cy="485" r="322" fill="rgba(255,255,255,0.28)"/>
  <circle cx="1240" cy="485" r="252" fill="rgba(255,255,255,0.52)"/>
  <path d="M0 940c220-110 450-134 686-70 138 38 269 48 404 28 130-18 300-83 510-193v495H0z" fill="rgba(255,255,255,0.52)"/>
  <rect x="86" y="86" width="1428" height="1028" rx="40" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
  <text x="118" y="162" fill="${dark}" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8">${category}</text>
  <text x="118" y="860" fill="${dark}" font-family="Arial, sans-serif" font-size="116" font-weight="800">${title}</text>
  <text x="118" y="936" fill="${dark}" opacity="0.74" font-family="Arial, sans-serif" font-size="48" font-weight="500">${subtitle}</text>
  <g>
    <rect x="118" y="990" width="220" height="78" rx="24" fill="rgba(255,255,255,0.8)"/>
    <text x="148" y="1044" fill="${dark}" font-family="Arial, sans-serif" font-size="34" font-weight="700">LAN PARTY</text>
  </g>
  <g>
    <circle cx="1240" cy="485" r="180" fill="${dark}" opacity="0.08"/>
    <text x="1240" y="525" text-anchor="middle" fill="${dark}" font-family="Arial, sans-serif" font-size="164" font-weight="800">${badge}</text>
  </g>
  ${patternFor(cover)}
</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });

for (const cover of covers) {
  const filePath = path.join(outDir, `${cover.id}.svg`);
  fs.writeFileSync(filePath, coverSvg(cover), 'utf8');
}

console.log(`Generated ${covers.length} cover assets in ${outDir}`);
