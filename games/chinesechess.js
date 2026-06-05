// games/chinesechess.js — 中国象棋 (2 players)
// 9×10 board, 7 piece types, check/checkmate detection

const ROWS = 10, COLS = 9;

// Bit flags for side
const RED = 0, BLACK = 1;

exports.name = 'chinesechess';
exports.maxPlayers = 2;

// Initial board layout
// Convention: row 0 = black's back rank (top), row 9 = red's back rank (bottom)
// RED is at bottom (rows 7-9), BLACK is at top (rows 0-2)
function createInitialBoard() {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const place = (row, col, type, side) => { board[row][col] = { type, side }; };

  // Black pieces (top, side 1)
  place(0, 0, 'R', BLACK); place(0, 1, 'H', BLACK); place(0, 2, 'E', BLACK);
  place(0, 3, 'A', BLACK); place(0, 4, 'K', BLACK); place(0, 5, 'A', BLACK);
  place(0, 6, 'E', BLACK); place(0, 7, 'H', BLACK); place(0, 8, 'R', BLACK);
  place(2, 1, 'C', BLACK); place(2, 7, 'C', BLACK);
  place(3, 0, 'P', BLACK); place(3, 2, 'P', BLACK); place(3, 4, 'P', BLACK);
  place(3, 6, 'P', BLACK); place(3, 8, 'P', BLACK);

  // Red pieces (bottom, side 0)
  place(9, 0, 'R', RED); place(9, 1, 'H', RED); place(9, 2, 'E', RED);
  place(9, 3, 'A', RED); place(9, 4, 'K', RED); place(9, 5, 'A', RED);
  place(9, 6, 'E', RED); place(9, 7, 'H', RED); place(9, 8, 'R', RED);
  place(7, 1, 'C', RED); place(7, 7, 'C', RED);
  place(6, 0, 'P', RED); place(6, 2, 'P', RED); place(6, 4, 'P', RED);
  place(6, 6, 'P', RED); place(6, 8, 'P', RED);

  return board;
}

exports.createState = () => ({
  currentPlayer: RED,
  winner: null,
  board: createInitialBoard(),
  moveHistory: [],      // [{ from, to, piece, captured }]
  _playerCount: 2,
});

// ---- Move Generation ----

function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

// Get king position for a side
function findKing(board, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] && board[r][c].type === 'K' && board[r][c].side === side)
        return { row: r, col: c };
  return null;
}

// Generate pseudo-legal moves for a piece at (r,c)
// Does NOT filter moves that leave own king in check — filtered later
function getPieceMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, side } = piece;
  const moves = [];
  const enemy = side === RED ? BLACK : RED;

  function addIfValid(tr, tc) {
    if (!inBounds(tr, tc)) return;
    const target = board[tr][tc];
    if (target && target.side === side) return; // can't capture own piece
    moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
  }

  function countBetween(dr, dc) {
    let count = 0;
    let cr = r + dr, cc = c + dc;
    while (inBounds(cr, cc) && cr !== dr === cr !== dr) {
      // just counting pieces between
    }
    // Re-implement per caller
  }

  switch (type) {
    case 'K': { // King: one step in 9-palace, cannot face other king
      const palace = side === RED
        ? { rMin: 7, rMax: 9, cMin: 3, cMax: 5 }
        : { rMin: 0, rMax: 2, cMin: 3, cMax: 5 };
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= palace.rMin && nr <= palace.rMax && nc >= palace.cMin && nc <= palace.cMax) {
          addIfValid(nr, nc);
        }
      }
      break;
    }
    case 'A': { // Advisor: diagonal one step in palace
      const palace = side === RED
        ? { rMin: 7, rMax: 9, cMin: 3, cMax: 5 }
        : { rMin: 0, rMax: 2, cMin: 3, cMax: 5 };
      const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= palace.rMin && nr <= palace.rMax && nc >= palace.cMin && nc <= palace.cMax) {
          addIfValid(nr, nc);
        }
      }
      break;
    }
    case 'E': { // Elephant: diagonal 2 steps, blocked by eye piece, cannot cross river
      const homeRows = side === RED ? [5,6,7,8,9] : [0,1,2,3,4];
      const dirs = [[2,2],[2,-2],[-2,2],[-2,-2]];
      const eyes = [[1,1],[1,-1],[-1,1],[-1,-1]];
      for (let i = 0; i < 4; i++) {
        const [dr, dc] = dirs[i];
        const [er, ec] = eyes[i];
        const nr = r + dr, nc = c + dc;
        const eyeR = r + er, eyeC = c + ec;
        if (inBounds(nr, nc) && homeRows.includes(nr)) {
          if (!board[eyeR][eyeC]) { // eye not blocked
            addIfValid(nr, nc);
          }
        }
      }
      break;
    }
    case 'H': { // Horse: L-shape, blocked by leg
      const steps = [
        [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1], [1, -2, 0, -1], [1, 2, 0, 1],
      ];
      for (let i = 0; i < 8; i++) {
        const dr = steps[i][0], dc = steps[i][1];
        const lr = r + steps[i][2], lc = c + steps[i][3]; // leg position
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !board[lr][lc]) {
          addIfValid(nr, nc);
        }
      }
      break;
    }
    case 'R': { // Rook: straight line
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
      for (const [dr, dc] of dirs) {
        for (let i = 1; i < 10; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!inBounds(nr, nc)) break;
          const target = board[nr][nc];
          if (target) {
            if (target.side === enemy) moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
            break; // blocked
          }
          moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
        }
      }
      break;
    }
    case 'C': { // Cannon: moves like rook, captures by jumping over exactly one piece
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
      for (const [dr, dc] of dirs) {
        for (let i = 1; i < 10; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!inBounds(nr, nc)) break;
          if (!board[nr][nc]) {
            moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
          } else {
            // Found a screen — look for capture beyond it
            for (let j = i + 1; j < 10; j++) {
              const cr = r + dr * j, cc = c + dc * j;
              if (!inBounds(cr, cc)) break;
              if (board[cr][cc]) {
                if (board[cr][cc].side === enemy) {
                  moves.push({ fromRow: r, fromCol: c, toRow: cr, toCol: cc });
                }
                break; // only capture first piece behind screen
              }
            }
            break; // don't continue non-capture moves past screen
          }
        }
      }
      break;
    }
    case 'P': { // Pawn: forward one; after crossing river, can also go sideways
      const forward = side === RED ? -1 : 1;
      const homeRows = side === RED ? [5,6,7,8,9] : [0,1,2,3,4];
      // Forward
      addIfValid(r + forward, c);
      // Sideways (only after crossing river)
      if (!homeRows.includes(r)) {
        addIfValid(r, c - 1);
        addIfValid(r, c + 1);
      }
      break;
    }
  }
  return moves;
}

// Check if a side's king is in check
function isInCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return true; // king captured = in check
  const enemy = side === RED ? BLACK : RED;

  // See if any enemy piece can capture the king
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].side === enemy) {
        const moves = getPieceMoves(board, r, c);
        for (const m of moves) {
          if (m.toRow === king.row && m.toCol === king.col) return true;
        }
      }
    }
  }
  return false;
}

// Check if two kings are facing each other (no piece between on same column)
function kingsAreFacing(board) {
  const redKing = findKing(board, RED);
  const blackKing = findKing(board, BLACK);
  if (!redKing || !blackKing) return false;
  if (redKing.col !== blackKing.col) return false;

  const minRow = Math.min(redKing.row, blackKing.row);
  const maxRow = Math.max(redKing.row, blackKing.row);
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[r][redKing.col]) return false; // piece between
  }
  return true;
}

// Make a move (mutate board), return captured piece if any
function makeMove(board, move) {
  const piece = board[move.fromRow][move.fromCol];
  const captured = board[move.toRow][move.toCol];
  board[move.toRow][move.toCol] = piece;
  board[move.fromRow][move.fromCol] = null;
  return captured;
}

function undoMove(board, move, captured) {
  const piece = board[move.toRow][move.toCol];
  board[move.fromRow][move.fromCol] = piece;
  board[move.toRow][move.toCol] = captured;
}

// Get all legal moves for a side (filtered for check + facing king rule)
function getLegalMoves(board, side) {
  const allMoves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].side === side) {
        const pieceMoves = getPieceMoves(board, r, c);
        for (const move of pieceMoves) {
          const captured = makeMove(board, move);
          if (!isInCheck(board, side) && !kingsAreFacing(board)) {
            allMoves.push(move);
          }
          undoMove(board, move, captured);
        }
      }
    }
  }
  return allMoves;
}

// ---- Handle Move ----

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  const { from, to } = data || {};
  if (!from || !to) return '无效的操作';
  const { row: fr, col: fc } = from;
  const { row: tr, col: tc } = to;

  if (!inBounds(fr, fc) || !inBounds(tr, tc)) return '超出棋盘范围';
  if (fr === tr && fc === tc) return '不能原地不动';

  const piece = state.board[fr][fc];
  if (!piece) return '该位置没有棋子';
  if (piece.side !== playerIndex) return '不能移动对方的棋子';

  const target = state.board[tr][tc];
  if (target && target.side === playerIndex) return '不能吃自己的棋子';

  // Validate move against legal moves
  const legalMoves = getLegalMoves(state.board, playerIndex);
  const found = legalMoves.find(m =>
    m.fromRow === fr && m.fromCol === fc && m.toRow === tr && m.toCol === tc
  );
  if (!found) return '不合法的走法';

  // Execute
  const captured = makeMove(state.board, found);
  state.moveHistory.push({ ...found, piece: { ...piece }, captured: captured ? { ...captured } : null });

  // Switch turn
  const enemy = playerIndex === RED ? BLACK : RED;
  state.currentPlayer = enemy;

  // Check if enemy has no legal moves → checkmate or stalemate
  const enemyMoves = getLegalMoves(state.board, enemy);
  if (enemyMoves.length === 0) {
    if (isInCheck(state.board, enemy)) {
      // Checkmate — current player wins
      state.winner = playerIndex;
    } else {
      // Stalemate — stalemated player loses in Chinese chess
      state.winner = playerIndex;
    }
  }

  return null;
};

// Per-player view: include legal moves for the current player only
exports.playerView = function(state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    board: state.board,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
  };
  // Only include legal moves if it is this player's turn and game is not over
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = getLegalMoves(state.board, playerIndex);
  } else {
    view.legalMoves = [];
  }
  return view;
};
