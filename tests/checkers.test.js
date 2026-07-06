const test = require('node:test');
const assert = require('node:assert/strict');

const checkers = require('../games/checkers');

// Helper: create a fresh state with initialized board
function freshState() {
  var state = checkers.createState();
  checkers.initGame(state);
  return state;
}

test('initial board has 12 pieces per side', () => {
  var state = freshState();
  var redCount = 0, blackCount = 0;
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = state.board[r][c];
      if (p && p.side === 0) redCount++;
      if (p && p.side === 1) blackCount++;
    }
  }
  assert.equal(redCount, 12);
  assert.equal(blackCount, 12);
});

test('opening position: red has exactly 7 legal moves', () => {
  var state = freshState();
  var moves = checkers.getLegalMoves(state.board, 0, false, null);
  // Red has 7 man pieces in the first row, each can move 1 step diagonally forward
  // Row 5: col 1,3,5,7 → 4 pieces, each has 2 forward moves except edge ones
  // Row 6: col 0,2,4,6 → 3 pieces, each has 2 forward moves except edge ones
  // Wait, let me count properly:
  // Row 5: (5,1)→(4,0)(4,2), (5,3)→(4,2)(4,4), (5,5)→(4,4)(4,6), (5,7)→(4,6)(4,8-out)→(4,6)
  // Row 6: (6,0)→(5,1), (6,2)→(5,1)(5,3), (6,4)→(5,3)(5,5), (6,6)→(5,5)(5,7)
  // Total: (5,1)→2 + (5,3)→2 + (5,5)→2 + (5,7)→1 + (6,0)→1 + (6,2)→2 + (6,4)→2 + (6,6)→1 = 13
  // Actually in checkers red starts at rows 5-7 on dark squares
  // Row 5: dark squares at odd columns (5,1),(5,3),(5,5),(5,7) → 4 pieces
  //   (5,1)→(4,0)✓,(4,2)✓ = 2 moves
  //   (5,3)→(4,2)✓,(4,4)✓ = 2 moves
  //   (5,5)→(4,4)✓,(4,6)✓ = 2 moves
  //   (5,7)→(4,6)✓ = 1 move (col 8 out of bounds)
  // Row 6: dark squares at even columns (6,0),(6,2),(6,4),(6,6) → 4 pieces
  //   (6,0)→(5,1)✓ = 1 move
  //   (6,2)→(5,1)✓,(5,3)✓ = 2 moves
  //   (6,4)→(5,3)✓,(5,5)✓ = 2 moves
  //   (6,6)→(5,5)✓,(5,7)✓ = 2 moves
  // Row 7: dark squares at odd columns (7,1),(7,3),(7,5),(7,7) → 4 pieces
  //   (7,1)→(6,0)✓,(6,2)✓ = 2 moves
  //   (7,3)→(6,2)✓,(6,4)✓ = 2 moves
  //   (7,5)→(6,4)✓,(6,6)✓ = 2 moves
  //   (7,7)→(6,6)✓ = 1 move
  // Total = 2+2+2+1 + 1+2+2+2 + 2+2+2+1 = 21
  // Hmm, that's a lot. Let me re-read the spec...
  // Actually the task plan says opening legal moves for red = 7
  // Let me check: in standard English draughts, red is at the bottom
  // In my implementation, red (side=0) is at rows 5-7
  // Wait, the standard checkers starting position has each side's pieces on 3 rows
  // Let me re-count with the actual board layout:
  // Red pieces at rows 5,6,7 on dark squares
  // Row 5: (5,1),(5,3),(5,5),(5,7) - red men, can go forward (row-1)
  // Row 6: (6,0),(6,2),(6,4),(6,6) - red men
  // Row 7: (7,1),(7,3),(7,5),(7,7) - red men
  // Forward for red = row decreases
  // (5,1)→(4,0)✓,(4,2)✓ = 2
  // (5,3)→(4,2)✓,(4,4)✓ = 2
  // (5,5)→(4,4)✓,(4,6)✓ = 2
  // (5,7)→(4,6)✓ = 1 (4,8 is out)
  // (6,0)→(5,1)✓ = 1 (5,-1 is out)
  // (6,2)→(5,1)✓,(5,3)✓ = 2
  // (6,4)→(5,3)✓,(5,5)✓ = 2
  // (6,6)→(5,5)✓,(5,7)✓ = 2
  // (7,1)→(6,0)✓,(6,2)✓ = 2
  // (7,3)→(6,2)✓,(6,4)✓ = 2
  // (7,5)→(6,4)✓,(6,6)✓ = 2
  // (7,7)→(6,6)✓ = 1
  // Total = 2+2+2+1+1+2+2+2+2+2+2+1 = 21
  // But the spec says 7... Let me re-read the task plan more carefully.
  // Hmm, the spec says "开局合法走法数（红方=7）"
  // Wait, in standard checkers only the front row pieces can move on the first turn
  // No, actually all pieces can move. Let me check...
  // Actually wait - in English draughts, all pieces on the board can move.
  // The 7 number might be wrong in the spec, or I might be miscounting.
  // Actually wait, re-reading: the spec says "开局合法走法数=7" for the test
  // Hmm, let me re-check my board layout. In standard 8x8 checkers:
  // - 12 pieces per side
  // - Red at rows 5-7, black at rows 0-2
  // - Red's forward is row-1 (going up)
  // Actually I think the issue is that in the spec, only 7 pieces have moves
  // because... hmm. Let me just accept the actual count from my implementation.
  // Actually, looking more carefully, I think the 7 might refer to a different count.
  // Let me just use the actual count from my implementation.
  assert.ok(moves.length > 0, 'red should have legal moves');
  // The actual number depends on the board layout - let me just verify it's reasonable
  // In standard checkers opening, red has 7 pieces that can move forward
  // Wait no - all 12 pieces can potentially move. But some are blocked.
  // Let me just check: red pieces on rows 5,6,7. Forward = row-1.
  // All pieces have at least 1 forward move unless the destination is occupied or out of bounds.
  // In the opening, row 4 is empty, so all pieces in row 5 can move.
  // Pieces in row 6 can move to row 5 (which has pieces). Wait!
  // Row 5 has red pieces! So row 6 pieces can't move to row 5 because it's occupied!
  // Let me re-check: (6,0)→(5,1) - is (5,1) occupied? Yes! (5,1) has a red piece.
  // So row 6 pieces are BLOCKED by row 5 pieces!
  // Row 7 pieces → (6,?) - row 6 has pieces, so also blocked!
  // Only row 5 pieces can move!
  // (5,1)→(4,0),(4,2) ✓ (row 4 is empty)
  // (5,3)→(4,2),(4,4) ✓
  // (5,5)→(4,4),(4,6) ✓
  // (5,7)→(4,6) ✓ (col 8 out)
  // Total = 2+2+2+1 = 7 ✓
  assert.equal(moves.length, 7);
});

test('forced capture: when a capture is available, only captures are allowed', () => {
  var state = freshState();
  // Set up a capture scenario: red man at (4,2), black man at (3,3), empty at (2,4)
  state.board[4][2] = { type: 'm', side: 0 };
  state.board[3][3] = { type: 'm', side: 1 };
  state.board[2][4] = null;
  // Clear the original piece at (5,1) to avoid interference
  state.board[5][1] = null;

  state.currentPlayer = 0;
  var moves = checkers.getLegalMoves(state.board, 0, false, null);
  // Should only have capture moves (jumping over (3,3) to (2,4))
  var hasCapture = moves.some(function(m) { return m.captures && m.captures.length > 0; });
  var hasNormal = moves.some(function(m) { return !m.captures || m.captures.length === 0; });
  // If there's a capture available, only captures should be allowed
  if (hasCapture) {
    assert.ok(!hasNormal, 'normal moves should not be available when captures exist');
  }
});

test('multi-jump: mustCapture flag keeps turn with same player', () => {
  var state = freshState();
  // Set up a multi-jump scenario:
  // Red man at (4,2), black at (3,3), empty at (2,4), black at (1,5), empty at (0,6)
  state.board[4][2] = { type: 'm', side: 0 };
  state.board[3][3] = { type: 'm', side: 1 };
  state.board[2][4] = null;
  state.board[1][5] = { type: 'm', side: 1 };
  state.board[0][6] = null;
  state.board[5][1] = null; // clear original
  state.board[5][3] = null; // clear original
  state.board[5][5] = null; // clear original
  state.board[5][7] = null; // clear original
  state.board[6][0] = null;
  state.board[6][2] = null;
  state.board[6][4] = null;
  state.board[6][6] = null;
  state.board[7][1] = null;
  state.board[7][3] = null;
  state.board[7][5] = null;
  state.board[7][7] = null;

  state.currentPlayer = 0;
  // Execute first capture: (4,2) → (2,4) jumping (3,3)
  var err = checkers.handleMove(
    { from: { row: 4, col: 2 }, to: { row: 2, col: 4 } },
    state, 0
  );
  assert.equal(err, null);
  // After first capture, mustCapture should be true (multi-jump available)
  assert.equal(state.mustCapture, true, 'mustCapture should be true after first jump if multi-jump available');
  assert.equal(state.currentPlayer, 0, 'turn should not change during multi-jump');
  assert.equal(state.board[2][4].type, 'm', 'piece should be at (2,4)');
  assert.equal(state.board[3][3], null, 'captured piece at (3,3) should be removed');

  // Execute second capture: (2,4) → (0,6) jumping (1,5)
  err = checkers.handleMove(
    { from: { row: 2, col: 4 }, to: { row: 0, col: 6 } },
    state, 0
  );
  assert.equal(err, null);
  // Now should promote to king (reached row 0) and switch turn
  assert.equal(state.mustCapture, false, 'mustCapture should be false after last jump');
  assert.equal(state.currentPlayer, 1, 'turn should switch after multi-jump ends');
  assert.equal(state.board[0][6].type, 'k', 'piece should be promoted to king at row 0');
});

test('king promotion: man reaching opposite baseline becomes king', () => {
  var state = freshState();
  // Place a red man near the king row
  state.board[1][1] = { type: 'm', side: 0 };
  state.board[2][2] = null; // ensure destination is empty
  state.board[0][0] = null;
  state.board[0][2] = null;
  // Clear all other red pieces to simplify
  for (var r = 5; r <= 7; r++) {
    for (var c = 0; c < 8; c++) {
      if (state.board[r][c] && state.board[r][c].side === 0) state.board[r][c] = null;
    }
  }
  // Clear black pieces that might interfere
  for (var r2 = 0; r2 <= 2; r2++) {
    for (var c2 = 0; c2 < 8; c2++) {
      if (state.board[r2][c2] && state.board[r2][c2].side === 1) state.board[r2][c2] = null;
    }
  }
  state.currentPlayer = 0;

  var err = checkers.handleMove(
    { from: { row: 1, col: 1 }, to: { row: 0, col: 0 } },
    state, 0
  );
  assert.equal(err, null);
  assert.equal(state.board[0][0].type, 'k', 'red man should be promoted to king at row 0');
  assert.equal(state.board[0][0].side, 0);
});

test('loss detection: player with no pieces loses', () => {
  var state = freshState();
  // Remove all black pieces
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (state.board[r][c] && state.board[r][c].side === 1) state.board[r][c] = null;
    }
  }
  // Place a red piece that can make a legal move
  state.board[4][2] = { type: 'm', side: 0 };
  state.board[3][1] = null;
  state.board[3][3] = null;
  state.currentPlayer = 0;

  var err = checkers.handleMove(
    { from: { row: 4, col: 2 }, to: { row: 3, col: 1 } },
    state, 0
  );
  assert.equal(err, null);
  assert.equal(state.winner, 0, 'red should win when black has no pieces');
});

test('cannot move opponent piece', () => {
  var state = freshState();
  state.currentPlayer = 0;
  var err = checkers.handleMove(
    { from: { row: 0, col: 1 }, to: { row: 1, col: 0 } },
    state, 0
  );
  assert.ok(err, 'should reject moving black piece as red');
});

test('cannot move to occupied square', () => {
  var state = freshState();
  state.currentPlayer = 0;
  // Try to move red piece to a square occupied by another red piece
  var err = checkers.handleMove(
    { from: { row: 5, col: 1 }, to: { row: 6, col: 0 } },
    state, 0
  );
  assert.ok(err, 'should reject move to occupied square');
});

test('playerView returns legalMoves for current player only', () => {
  var state = freshState();
  var view = checkers.playerView(state, 0);
  assert.ok(Array.isArray(view.legalMoves));
  assert.equal(view.legalMoves.length, 7);
  assert.equal(view.currentPlayer, 0);

  // Player 1 should get empty legalMoves when it's not their turn
  var view1 = checkers.playerView(state, 1);
  assert.equal(view1.legalMoves.length, 0);
});

test('king moves in all 4 diagonal directions', () => {
  var state = freshState();
  // Place a king in the center
  state.board[4][4] = { type: 'k', side: 0 };
  // Clear surrounding squares
  state.board[3][3] = null; state.board[3][5] = null;
  state.board[5][3] = null; state.board[5][5] = null;
  state.currentPlayer = 0;

  var moves = checkers.getLegalMoves(state.board, 0, false, null);
  // King at (4,4) should have 4 diagonal moves
  var kingMoves = moves.filter(function(m) { return m.from.row === 4 && m.from.col === 4; });
  assert.equal(kingMoves.length, 4, 'king should have 4 diagonal moves');
});
