const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'public', 'assets', 'game-covers');
const tempDir = path.join(rootDir, 'tmp', 'cover-scenes');

const browserPathCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const covers = [
  { id: 'tictactoe', palette: ['#f4efe7', '#d4b186', '#7a4f2e', '#241810'], motif: 'tictactoe' },
  { id: 'gomoku', palette: ['#f1ece4', '#d8b98c', '#8a6036', '#1d140f'], motif: 'gomoku' },
  { id: 'davinci', palette: ['#f2eee9', '#cfd6dc', '#5f7886', '#182129'], motif: 'davinci' },
  { id: 'uno', palette: ['#f8f2ec', '#ed6d54', '#f2b544', '#2b1710'], motif: 'uno' },
  { id: 'doudizhu', palette: ['#f5efe7', '#d8b07b', '#9a4538', '#1f1410'], motif: 'doudizhu' },
  { id: 'exploding-kittens', palette: ['#f8efe9', '#f29a62', '#c54c3f', '#23140f'], motif: 'exploding-kittens' },
  { id: 'rummikub', palette: ['#f1ede5', '#c3d4d1', '#66958d', '#1b2724'], motif: 'rummikub' },
  { id: 'twentyfour', palette: ['#f3f0ea', '#d3dae7', '#6389bc', '#18212d'], motif: 'twentyfour' },
  { id: 'minesweeper', palette: ['#eef3ef', '#c4d3c8', '#6e8f7a', '#18211c'], motif: 'minesweeper' },
  { id: 'numberbomb', palette: ['#f7f0e8', '#e7c196', '#d66e47', '#2a1711'], motif: 'numberbomb' },
  { id: 'oldmaid', palette: ['#f5edf2', '#d7c3d4', '#8f6288', '#22161f'], motif: 'oldmaid' },
  { id: 'liarsbar', palette: ['#f2ece4', '#d4bea0', '#8a6246', '#1c140f'], motif: 'liarsbar' },
  { id: 'bigtwo', palette: ['#f2ede5', '#c6cfde', '#607fa9', '#18212d'], motif: 'bigtwo' },
  { id: 'texas', palette: ['#f0ebe2', '#c9d5c8', '#3c6f5a', '#15211b'], motif: 'texas' },
  { id: 'flightchess', palette: ['#f4eee4', '#d1d9e4', '#678db8', '#192637'], motif: 'flightchess' },
  { id: 'snakebattle', palette: ['#edf3ed', '#c6d7c7', '#6f9b68', '#152018'], motif: 'snakebattle' },
  { id: 'chinesechess', palette: ['#f3ebe1', '#e0c7a8', '#b76c53', '#261611'], motif: 'chinesechess' },
  { id: 'chess', palette: ['#f0d9b5', '#b58863', '#3b2a1a', '#1a1208'], motif: 'chess' },
  { id: 'checkers', palette: ['#eeeed2', '#769656', '#3a5a1c', '#1a2a0a'], motif: 'checkers' },
  { id: 'connect4', palette: ['#f5f5f5', '#2e7dcc', '#e8c623', '#cc3333'], motif: 'connect4' },
  { id: 'reversi', palette: ['#2a8a3a', '#1a5a2a', '#ffffff', '#111111'], motif: 'reversi' },
  { id: 'go9', palette: ['#eee8dd', '#d4bc95', '#967145', '#1d140e'], motif: 'go9' },
  { id: 'monopoly', palette: ['#f5f0e5', '#d2c7b4', '#90aab4', '#1c2228'], motif: 'monopoly' },
  { id: 'suikabattle', palette: ['#f8f1e6', '#f0d39f', '#de874d', '#27170f'], motif: 'suikabattle' },
  { id: 'sheeptile', palette: ['#eef1e7', '#d9dfc7', '#89a36d', '#182015'], motif: 'sheeptile' },
  { id: 'drawguess', palette: ['#f6efe9', '#ddd0c2', '#c8856a', '#231816'], motif: 'drawguess' },
  { id: 'hearts', palette: ['#f5e8e8', '#e8a0a0', '#c23030', '#1a0a0a'], motif: 'hearts' },
  { id: 'truthdare', palette: ['#f2e8f0', '#d4a0c8', '#8a3070', '#1a1020'], motif: 'truthdare' },
  { id: 'battleship', palette: ['#e8eef4', '#7cafc2', '#2a6f8a', '#142a35'], motif: 'battleship' },
  { id: 'backgammon', palette: ['#f0e8d8', '#c8a878', '#1a5c2a', '#3a2210'], motif: 'backgammon' },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findBrowser() {
  return browserPathCandidates.find((candidate) => fs.existsSync(candidate));
}

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/')}`;
}

function block(x, y, w, h, r, fill, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function circle(cx, cy, r, fill, opacity = 1) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function line(x1, y1, x2, y2, stroke, width, opacity = 1) {
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" fill="none"/>`;
}

function motifSvg(cover) {
  const accent = cover.palette[2];
  const dark = cover.palette[3];

  switch (cover.motif) {
    case 'tictactoe':
      return `
        ${block(910, 250, 480, 480, 42, '#f9f4eb')}
        ${line(1070, 305, 1070, 675, accent, 24)}
        ${line(1230, 305, 1230, 675, accent, 24)}
        ${line(965, 410, 1335, 410, accent, 24)}
        ${line(965, 570, 1335, 570, accent, 24)}
        ${circle(1008, 348, 52, 'none')}
        <circle cx="1008" cy="348" r="52" stroke="${dark}" stroke-width="18" fill="none"/>
        ${line(1176, 520, 1288, 632, dark, 18)}
        ${line(1288, 520, 1176, 632, dark, 18)}
        ${circle(1250, 350, 52, 'none')}
        <circle cx="1250" cy="350" r="52" stroke="${dark}" stroke-width="18" fill="none"/>
      `;
    case 'gomoku':
      return `
        ${block(900, 215, 520, 520, 34, '#dcc094')}
        ${Array.from({ length: 9 }, (_, i) => line(965 + i * 55, 275, 965 + i * 55, 675, dark, 6, 0.35)).join('')}
        ${Array.from({ length: 9 }, (_, i) => line(965, 275 + i * 55, 1365, 275 + i * 55, dark, 6, 0.35)).join('')}
        ${circle(1080, 440, 24, dark)}
        ${circle(1135, 495, 24, dark)}
        ${circle(1190, 550, 24, dark)}
        ${circle(1245, 605, 24, dark)}
        ${circle(1300, 660, 24, dark)}
        <circle cx="1025" cy="330" r="24" fill="#fff7ec" stroke="${accent}" stroke-width="8"/>
        <circle cx="1080" cy="330" r="24" fill="#fff7ec" stroke="${accent}" stroke-width="8"/>
      `;
    case 'davinci':
      return `
        ${block(945, 250, 150, 230, 24, '#fff8ef')}
        ${block(1110, 310, 150, 230, 24, '#f5efe7')}
        ${block(1275, 370, 150, 230, 24, '#223340')}
        ${block(1020, 570, 150, 230, 24, '#7aa4b4')}
        ${block(1185, 630, 150, 230, 24, '#fff8ef')}
        ${Array.from({ length: 4 }, (_, i) => circle(1010 + i * 150, 890, 16, accent, 0.45)).join('')}
      `;
    case 'uno':
      return `
        <g transform="rotate(-18 1130 520)">${block(980, 290, 210, 320, 28, '#ef5a45')}</g>
        <g transform="rotate(-6 1190 470)">${block(1080, 220, 210, 320, 28, '#f2b441')}</g>
        <g transform="rotate(9 1250 520)">${block(1180, 290, 210, 320, 28, '#467fd8')}</g>
        <g transform="rotate(21 1190 670)">${block(1088, 560, 210, 320, 28, '#55a86b')}</g>
        ${circle(1150, 540, 72, '#fff7ef', 0.92)}
      `;
    case 'doudizhu':
      return `
        <g transform="rotate(-16 1130 420)">${block(1010, 255, 130, 220, 22, '#fff8ef')}</g>
        <g transform="rotate(-6 1195 395)">${block(1090, 230, 130, 220, 22, '#fff8ef')}</g>
        <g transform="rotate(6 1260 395)">${block(1170, 230, 130, 220, 22, '#fff8ef')}</g>
        <g transform="rotate(18 1330 430)">${block(1250, 265, 130, 220, 22, '#fff8ef')}</g>
        ${circle(1115, 700, 42, accent)}
        ${circle(1215, 760, 42, '#c9a15a')}
        ${circle(1310, 705, 42, dark, 0.85)}
      `;
    case 'exploding-kittens':
      return `
        <path d="M1178 248l54 120 132 18-98 90 26 132-114-64-114 64 26-132-98-90 132-18z" fill="${accent}" opacity="0.94"/>
        ${circle(1160, 730, 90, '#fff8ef')}
        ${circle(1270, 640, 70, '#fff8ef')}
        ${line(1110, 705, 1210, 705, dark, 14)}
        ${line(1240, 620, 1300, 620, dark, 14)}
      `;
    case 'rummikub':
      return `
        ${block(980, 690, 390, 34, 17, dark)}
        ${block(1015, 555, 78, 110, 18, '#4d8cc7')}
        ${block(1110, 500, 78, 165, 18, '#d56446')}
        ${block(1205, 445, 78, 220, 18, '#e3bf54')}
        ${block(1300, 530, 78, 135, 18, '#66a57a')}
        ${Array.from({ length: 4 }, (_, i) => block(1025 + i * 96, 280 + i * 18, 80, 110, 18, '#fff8ef', 0.88)).join('')}
      `;
    case 'twentyfour':
      return `
        ${block(960, 300, 140, 180, 20, '#fff8ef')}
        ${block(1110, 300, 140, 180, 20, '#fff8ef')}
        ${block(1260, 300, 140, 180, 20, '#fff8ef')}
        ${block(1110, 505, 140, 180, 20, '#fff8ef')}
        ${circle(1180, 790, 96, '#fff8ef')}
        ${line(1090, 790, 1270, 790, accent, 18)}
        ${line(1180, 700, 1180, 880, dark, 18)}
      `;
    case 'minesweeper':
      return `
        ${block(970, 250, 380, 380, 26, '#f7fbf8')}
        ${Array.from({ length: 4 }, (_, i) => line(1060 + i * 80, 270, 1060 + i * 80, 610, accent, 8, 0.35)).join('')}
        ${Array.from({ length: 4 }, (_, i) => line(990, 340 + i * 80, 1330, 340 + i * 80, accent, 8, 0.35)).join('')}
        ${circle(1170, 430, 62, dark)}
        ${line(1170, 340, 1170, 520, '#fff', 12)}
        ${line(1080, 430, 1260, 430, '#fff', 12)}
        ${line(1105, 365, 1235, 495, '#fff', 12)}
        ${line(1235, 365, 1105, 495, '#fff', 12)}
      `;
    case 'numberbomb':
      return `
        ${block(970, 308, 390, 36, 18, accent, 0.28)}
        ${block(1050, 308, 230, 36, 18, accent)}
        ${circle(1050, 326, 30, '#fff8ef')}
        ${circle(1280, 326, 30, '#fff8ef')}
        <circle cx="1050" cy="326" r="30" stroke="${dark}" stroke-width="10" fill="none"/>
        <circle cx="1280" cy="326" r="30" stroke="${dark}" stroke-width="10" fill="none"/>
        <path d="M1180 535l46 106 112 12-84 74 23 108-97-54-97 54 23-108-84-74 112-12z" fill="${dark}" opacity="0.92"/>
      `;
    case 'oldmaid':
      return `
        ${circle(1100, 410, 95, 'none')}
        ${circle(1260, 560, 95, 'none')}
        ${circle(1125, 760, 95, 'none')}
        <circle cx="1100" cy="410" r="95" stroke="${accent}" stroke-width="28" fill="none"/>
        <circle cx="1260" cy="560" r="95" stroke="${dark}" stroke-width="28" fill="none"/>
        <circle cx="1125" cy="760" r="95" stroke="#fff7ef" stroke-width="28" fill="none"/>
        ${block(1280, 285, 90, 140, 18, '#fff8ef')}
      `;
    case 'liarsbar':
      return `
        ${block(1030, 305, 102, 210, 28, '#fff7eb')}
        ${block(1160, 250, 102, 265, 28, '#fff7eb')}
        ${block(1290, 335, 102, 180, 28, '#fff7eb')}
        ${line(1005, 645, 1245, 645, dark, 18)}
        ${line(1175, 645, 1425, 645, dark, 18)}
        ${block(1045, 710, 155, 120, 22, accent, 0.22)}
      `;
    case 'bigtwo':
      return `
        ${block(1025, 290, 255, 155, 28, '#fff8ef')}
        ${block(1070, 480, 255, 155, 28, '#fff8ef')}
        ${block(1115, 670, 255, 155, 28, '#fff8ef')}
        ${circle(1250, 385, 30, accent)}
        ${circle(1205, 575, 30, dark)}
      `;
    case 'texas':
      return `
        ${circle(1080, 390, 86, '#fff8ef')}
        ${circle(1240, 545, 86, '#fff8ef')}
        ${circle(1110, 715, 86, '#fff8ef')}
        <circle cx="1080" cy="390" r="86" stroke="${accent}" stroke-width="24" fill="none"/>
        <circle cx="1240" cy="545" r="86" stroke="${dark}" stroke-width="24" fill="none"/>
        <circle cx="1110" cy="715" r="86" stroke="${accent}" stroke-width="24" fill="none"/>
        ${block(1285, 285, 105, 150, 20, '#fff8ef')}
        ${block(1160, 310, 105, 150, 20, '#fff8ef')}
      `;
    case 'flightchess':
      return `
        ${circle(1080, 360, 58, '#4aa3ff')}
        ${circle(1250, 360, 58, '#efc34a')}
        ${circle(1080, 530, 58, '#ee6d5e')}
        ${circle(1250, 530, 58, '#5cb274')}
        ${line(1165, 255, 1165, 648, dark, 18)}
        ${line(970, 448, 1360, 448, dark, 18)}
        <path d="M1118 715l62-84 62 84-62 116z" fill="#fff8ef" stroke="${dark}" stroke-width="14"/>
      `;
    case 'snakebattle':
      return `
        <path d="M1000 685c68-165 270-212 367-120 66 64 47 166-55 176-76 8-124-46-124-98 0-43 34-78 74-78 40 0 65 24 65 54" stroke="${accent}" stroke-width="42" stroke-linecap="round" fill="none"/>
        ${circle(1372, 565, 24, dark)}
        ${circle(1376, 558, 5, '#fff')}
        ${block(1050, 290, 250, 120, 28, '#f8fbf7')}
      `;
    case 'chinesechess':
      return `
        ${block(955, 260, 410, 420, 34, '#ecd3aa')}
        ${Array.from({ length: 5 }, (_, i) => line(1020 + i * 85, 285, 1020 + i * 85, 655, dark, 8, 0.45)).join('')}
        ${Array.from({ length: 5 }, (_, i) => line(980, 335 + i * 75, 1340, 335 + i * 75, dark, 8, 0.45)).join('')}
        ${line(1040, 360, 1280, 590, accent, 16)}
        ${line(1280, 360, 1040, 590, accent, 16)}
        ${circle(1075, 720, 64, '#fff7ef')}
        ${circle(1240, 720, 64, '#fff7ef')}
      `;
    case 'chess':
      return `
        ${block(955, 260, 410, 410, 12, '#f0d9b5')}
        ${Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            if ((row + col) % 2 === 1) {
              return block(955 + col * 51.25, 260 + row * 51.25, 51.25, 51.25, 0, '#b58863');
            }
            return '';
          }).join('')
        ).join('')}
        <text x="985" y="315" font-size="38" fill="${dark}" font-family="serif" opacity="0.85">♔</text>
        <text x="1135" y="415" font-size="42" fill="#fff8ef" font-family="serif" opacity="0.9">♚</text>
        <text x="1250" y="510" font-size="34" fill="${dark}" font-family="serif" opacity="0.8">♕</text>
        <text x="1050" y="560" font-size="30" fill="#fff8ef" font-family="serif" opacity="0.85">♞</text>
      `;
    case 'checkers':
      return `
        ${block(955, 260, 410, 410, 12, '#eeeed2')}
        ${Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            if ((row + col) % 2 === 1) {
              return block(955 + col * 51.25, 260 + row * 51.25, 51.25, 51.25, 0, '#769656');
            }
            return '';
          }).join('')
        ).join('')}
        ${circle(1010, 310, 18, dark)}
        ${circle(1112, 310, 18, dark)}
        ${circle(1215, 310, 18, dark)}
        ${circle(1060, 415, 18, '#fff8ef')}
        ${circle(1165, 415, 18, '#fff8ef')}
        <circle cx="1010" cy="310" r="18" stroke="#fff8ef" stroke-width="4" fill="none"/>
        <circle cx="1215" cy="310" r="18" stroke="#fff8ef" stroke-width="4" fill="none"/>
      `;
    case 'connect4':
      return `
        ${block(960, 255, 400, 400, 28, '#2e7dcc')}
        ${Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 7 }, (_, col) => circle(1016 + col * 54, 310 + row * 58, 22, '#f5f5f5', 0.2)).join('')
        ).join('')}
        ${circle(1070, 368, 22, '#e8c623')}
        ${circle(1124, 368, 22, '#e8c623')}
        ${circle(1178, 368, 22, '#e8c623')}
        ${circle(1232, 368, 22, '#e8c623')}
        ${circle(1124, 426, 22, '#cc3333')}
        ${circle(1178, 426, 22, '#e8c623')}
        ${circle(1178, 484, 22, '#cc3333')}
      `;
    case 'reversi':
      return `
        ${block(955, 260, 410, 410, 14, '#2a8a3a')}
        ${Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            const x = 980 + col * 48;
            const y = 285 + row * 48;
            if (row === 3 && col === 3) return circle(x + 24, y + 24, 16, '#ffffff');
            if (row === 3 && col === 4) return circle(x + 24, y + 24, 16, '#111111');
            if (row === 4 && col === 3) return circle(x + 24, y + 24, 16, '#111111');
            if (row === 4 && col === 4) return circle(x + 24, y + 24, 16, '#ffffff');
            return '';
          }).join('')
        ).join('')}
        <circle cx="1004" cy="309" r="16" stroke="#1a5a2a" stroke-width="3" fill="none"/>
        <circle cx="1100" cy="405" r="16" stroke="#1a5a2a" stroke-width="3" fill="none"/>
      `;
    case 'go9':
      return `
        ${block(965, 260, 400, 400, 28, '#e3c889')}
        ${Array.from({ length: 5 }, (_, i) => line(1035 + i * 74, 290, 1035 + i * 74, 630, dark, 7, 0.48)).join('')}
        ${Array.from({ length: 5 }, (_, i) => line(995, 330 + i * 74, 1335, 330 + i * 74, dark, 7, 0.48)).join('')}
        ${circle(1085, 405, 30, dark)}
        ${circle(1230, 550, 30, '#fff8ef')}
        <circle cx="1230" cy="550" r="30" stroke="${accent}" stroke-width="10" fill="none"/>
        ${circle(1160, 475, 30, dark)}
      `;
    case 'monopoly':
      return `
        ${block(960, 300, 390, 390, 34, '#f7f3eb')}
        ${block(996, 336, 318, 318, 26, '#dfd3bc')}
        ${block(1020, 360, 85, 85, 18, accent, 0.85)}
        ${block(1200, 360, 85, 85, 18, '#96aeb7', 0.9)}
        ${block(1020, 540, 85, 85, 18, '#b2a48d', 0.9)}
        ${block(1200, 540, 85, 85, 18, dark, 0.78)}
        ${block(1128, 462, 60, 180, 18, '#dbc27c')}
        ${line(1088, 515, 1228, 515, '#fff7ef', 14)}
      `;
    case 'suikabattle':
      return `
        ${circle(1085, 645, 80, '#ef715c')}
        ${circle(1235, 540, 102, '#f1c44c')}
        ${circle(1310, 740, 74, '#89cb70')}
        ${circle(1015, 780, 52, '#f6a24d')}
        ${line(1242, 438, 1312, 390, dark, 14)}
      `;
    case 'sheeptile':
      return `
        ${block(1015, 345, 128, 128, 22, '#fff8ef')}
        ${block(1155, 450, 128, 128, 22, '#fff8ef')}
        ${block(1085, 605, 128, 128, 22, '#fff8ef')}
        ${circle(1330, 760, 66, '#f7faf2')}
        ${circle(1372, 745, 24, dark)}
        ${circle(1326, 768, 10, dark, 0.65)}
      `;
    case 'drawguess':
      return `
        ${block(1000, 280, 335, 445, 32, '#fff9ef')}
        ${line(1072, 385, 1236, 365, dark, 16)}
        ${line(1085, 500, 1275, 560, dark, 16)}
        ${line(1098, 602, 1225, 655, dark, 16)}
        <path d="M1288 815l-40-118 42-24 56 100z" fill="${accent}"/>
        ${block(920, 790, 210, 100, 22, accent, 0.16)}
      `;
    case 'hearts':
      return `
        <text x="800" y="600" text-anchor="middle" font-size="320" fill="${accent}" opacity="0.85">♥</text>
        <text x="680" y="420" text-anchor="middle" font-size="180" fill="${dark}" opacity="0.5">♥</text>
        <text x="950" y="750" text-anchor="middle" font-size="140" fill="${accent}" opacity="0.4">♥</text>
      `;
    case 'truthdare':
      return `
        <text x="800" y="520" text-anchor="middle" font-size="160" font-weight="bold" fill="${accent}" opacity="0.85">?</text>
        <text x="600" y="700" text-anchor="middle" font-size="120" fill="${dark}" opacity="0.4">?</text>
        <text x="1000" y="680" text-anchor="middle" font-size="100" fill="${accent}" opacity="0.35">?</text>
      `;
    case 'battleship':
      return `
        ${block(920, 260, 200, 200, 18, '#f0f4f8', 0.85)}
        ${block(1160, 360, 200, 200, 18, '#f0f4f8', 0.85)}
        ${Array.from({ length: 5 }, (_, i) => line(920 + i * 50, 260, 920 + i * 50, 460, accent, 6, 0.3)).join('')}
        ${Array.from({ length: 5 }, (_, i) => line(920, 260 + i * 50, 1120, 260 + i * 50, accent, 6, 0.3)).join('')}
        ${Array.from({ length: 5 }, (_, i) => line(1160 + i * 50, 360, 1160 + i * 50, 560, accent, 6, 0.3)).join('')}
        ${Array.from({ length: 5 }, (_, i) => line(1160, 360 + i * 50, 1360, 360 + i * 50, accent, 6, 0.3)).join('')}
        ${block(930, 270, 150, 30, 8, '#2a6f8a', 0.7)}
        ${block(930, 310, 120, 30, 8, '#2a6f8a', 0.6)}
        ${circle(1260, 460, 16, '#c62828')}
        <line x1="1250" y1="450" x2="1270" y2="470" stroke="#c62828" stroke-width="6" stroke-linecap="round"/>
        <line x1="1270" y1="450" x2="1250" y2="470" stroke="#c62828" stroke-width="6" stroke-linecap="round"/>
        ${circle(1310, 510, 8, '#90a4ae')}
      `;
    case 'backgammon':
      return `
        ${block(920, 280, 520, 380, 24, '#1a5c2a')}
        ${Array.from({ length: 6 }, (_, i) => {
          const x = 940 + i * 42;
          return `<path d="M${x} 280 L${x + 42} 280 L${x + 21} 480 Z" fill="${i % 2 === 0 ? '#5a3a1a' : '#e8d5a8'}"/>`;
        }).join('')}
        ${Array.from({ length: 6 }, (_, i) => {
          const x = 940 + i * 42;
          return `<path d="M${x} 660 L${x + 42} 660 L${x + 21} 460 Z" fill="${i % 2 === 0 ? '#e8d5a8' : '#5a3a1a'}"/>`;
        }).join('')}
        ${circle(1050, 340, 22, '#f5f0e0')}
        ${circle(1050, 390, 22, '#f5f0e0')}
        ${circle(1120, 560, 22, '#2a2a2a')}
        ${circle(1120, 610, 22, '#2a2a2a')}
        ${circle(1200, 310, 18, '#f5f0e0')}
        ${circle(1280, 580, 18, '#2a2a2a')}
      `;
    default:
      return '';
  }
}

function coverSvg(cover) {
  const [bgA, bgB, accent, dark] = cover.palette;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-label="${cover.id}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgA}"/>
      <stop offset="100%" stop-color="${bgB}"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="32%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.8)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <linearGradient id="table" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.42)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.16)"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" rx="56" fill="url(#bg)"/>
  <rect width="1600" height="1200" rx="56" fill="url(#glow)"/>
  <path d="M0 946c246-92 500-115 760-68 110 20 240 36 390 10 152-26 294-82 450-176v488H0z" fill="rgba(255,255,255,0.34)"/>
  <rect x="84" y="84" width="1432" height="1032" rx="46" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>
  <rect x="128" y="152" width="1344" height="896" rx="40" fill="url(#table)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <ellipse cx="1188" cy="905" rx="270" ry="58" fill="${dark}" opacity="0.12"/>
  <ellipse cx="1188" cy="905" rx="204" ry="38" fill="${dark}" opacity="0.08"/>
  ${motifSvg(cover)}
  ${block(138, 188, 120, 12, 6, accent, 0.7)}
  ${block(138, 210, 82, 10, 5, dark, 0.18)}
</svg>`;
}

const variantMap = {
  texas: 'texas-table',
  flightchess: 'flightchess-race',
  monopoly: 'monopoly-golden-city',
  suikabattle: 'suika-fruit-arena',
  sheeptile: 'sheeptile-pasture',
  drawguess: 'drawguess-party',
};

function writeSvgAndRenderPng(cover, browserPath) {
  const svgPath = path.join(tempDir, `${cover.id}.svg`);
  const pngPath = path.join(outDir, `${cover.id}.png`);
  fs.writeFileSync(svgPath, coverSvg(cover), 'utf8');

  const result = spawnSync(browserPath, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1600,1200',
    `--screenshot=${pngPath}`,
    fileUrl(svgPath),
  ], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`Failed to render ${cover.id}: ${result.stderr || result.stdout || 'unknown browser error'}`);
  }
}

function main() {
  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No supported browser found for PNG cover rendering.');
  }

  ensureDir(outDir);
  ensureDir(tempDir);

  for (const cover of covers) {
    writeSvgAndRenderPng(cover, browserPath);
    // Also write any custom variant filenames referenced by game-catalog.js
    const variant = variantMap[cover.id];
    if (variant) {
      const srcPath = path.join(outDir, `${cover.id}.png`);
      const dstPath = path.join(outDir, `${variant}.png`);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  console.log(`Generated ${covers.length} bitmap cover assets in ${outDir}`);
}

main();
