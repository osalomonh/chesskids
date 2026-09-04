import {
  kingMoves, knightMoves, rookMoves,
  bishopMoves, queenMoves, pawnMoves, movesFrom,
} from "./moves.js";
import type { Square, Board, Piece, Move } from "./moves.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: Square[], expected: number) {
  if (actual.length === expected) {
    console.log(`  PASS  ${label}  (${expected})`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}  expected ${expected}, got ${actual.length}`);
    console.log(`        ${JSON.stringify(actual)}`);
    failed++;
  }
}

function hasSquare(actual: Square[], square: Square): boolean {
  return actual.some(sq => sq.file === square.file && sq.rank === square.rank);
}

function checkIncludes(label: string, actual: Square[], square: Square) {
  if (hasSquare(actual, square)) {
    console.log(`  PASS  ${label}  (includes {file:${square.file},rank:${square.rank}})`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}  expected {file:${square.file},rank:${square.rank}} to be present`);
    console.log(`        ${JSON.stringify(actual)}`);
    failed++;
  }
}

function checkExcludes(label: string, actual: Square[], square: Square) {
  if (!hasSquare(actual, square)) {
    console.log(`  PASS  ${label}  (excludes {file:${square.file},rank:${square.rank}})`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}  expected {file:${square.file},rank:${square.rank}} to be absent`);
    console.log(`        ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ---- king ----
console.log("\nking");
{
  const from: Square = { file: 4, rank: 4 };
  const friendlyBlocked: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "king" },
      { square: { file: 5, rank: 5 }, color: "white", type: "pawn" },
    ],
  };
  const moves = kingMoves(from, friendlyBlocked);
  check("friendly-blocked count", moves, 7);
  checkExcludes("friendly-blocked excludes friendly square", moves, { file: 5, rank: 5 });

  const enemyCapturable: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "king" },
      { square: { file: 5, rank: 5 }, color: "black", type: "pawn" },
    ],
  };
  const moves2 = kingMoves(from, enemyCapturable);
  check("enemy-capturable count", moves2, 8);
  checkIncludes("enemy-capturable includes enemy square", moves2, { file: 5, rank: 5 });
}

// ---- knight ----
console.log("\nknight");
{
  const from: Square = { file: 4, rank: 4 };
  const friendlyBlocked: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "knight" },
      { square: { file: 6, rank: 5 }, color: "white", type: "pawn" },
    ],
  };
  const moves = knightMoves(from, friendlyBlocked);
  check("friendly-blocked count", moves, 7);
  checkExcludes("friendly-blocked excludes friendly square", moves, { file: 6, rank: 5 });

  const enemyCapturable: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "knight" },
      { square: { file: 6, rank: 5 }, color: "black", type: "pawn" },
    ],
  };
  const moves2 = knightMoves(from, enemyCapturable);
  check("enemy-capturable count", moves2, 8);
  checkIncludes("enemy-capturable includes enemy square", moves2, { file: 6, rank: 5 });
}

// ---- rook ----
console.log("\nrook");
{
  const from: Square = { file: 0, rank: 0 };
  const friendlyBlocked: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "rook" },
      { square: { file: 0, rank: 3 }, color: "white", type: "pawn" },
    ],
  };
  const moves = rookMoves(from, friendlyBlocked);
  check("friendly-blocked count", moves, 9);
  checkExcludes("friendly-blocked excludes friendly square", moves, { file: 0, rank: 3 });
  checkExcludes("friendly-blocked excludes beyond blocker", moves, { file: 0, rank: 4 });

  const enemyCapturable: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "rook" },
      { square: { file: 0, rank: 3 }, color: "black", type: "pawn" },
    ],
  };
  const moves2 = rookMoves(from, enemyCapturable);
  check("enemy-capturable count", moves2, 10);
  checkIncludes("enemy-capturable includes enemy square", moves2, { file: 0, rank: 3 });
  checkExcludes("enemy-capturable excludes beyond captured piece", moves2, { file: 0, rank: 4 });
}

// ---- bishop ----
console.log("\nbishop");
{
  const from: Square = { file: 0, rank: 0 };
  const friendlyBlocked: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "bishop" },
      { square: { file: 3, rank: 3 }, color: "white", type: "pawn" },
    ],
  };
  const moves = bishopMoves(from, friendlyBlocked);
  check("friendly-blocked count", moves, 2);
  checkExcludes("friendly-blocked excludes friendly square", moves, { file: 3, rank: 3 });
  checkExcludes("friendly-blocked excludes beyond blocker", moves, { file: 4, rank: 4 });

  const enemyCapturable: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "bishop" },
      { square: { file: 3, rank: 3 }, color: "black", type: "pawn" },
    ],
  };
  const moves2 = bishopMoves(from, enemyCapturable);
  check("enemy-capturable count", moves2, 3);
  checkIncludes("enemy-capturable includes enemy square", moves2, { file: 3, rank: 3 });
  checkExcludes("enemy-capturable excludes beyond captured piece", moves2, { file: 4, rank: 4 });
}

// ---- queen ----
console.log("\nqueen");
{
  const from: Square = { file: 4, rank: 4 };
  const friendlyBlocked: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "queen" },
      { square: { file: 4, rank: 6 }, color: "white", type: "pawn" },
    ],
  };
  const moves = queenMoves(from, friendlyBlocked);
  check("friendly-blocked count", moves, 25);
  checkExcludes("friendly-blocked excludes friendly square", moves, { file: 4, rank: 6 });
  checkExcludes("friendly-blocked excludes beyond blocker", moves, { file: 4, rank: 7 });

  const enemyCapturable: Board = {
    size: 8,
    pieces: [
      { square: from, color: "white", type: "queen" },
      { square: { file: 4, rank: 6 }, color: "black", type: "pawn" },
    ],
  };
  const moves2 = queenMoves(from, enemyCapturable);
  check("enemy-capturable count", moves2, 26);
  checkIncludes("enemy-capturable includes enemy square", moves2, { file: 4, rank: 6 });
  checkExcludes("enemy-capturable excludes beyond captured piece", moves2, { file: 4, rank: 7 });
}

// ---- pawn ----
console.log("\npawn");
{
  const from: Square = { file: 4, rank: 3 };
  const mover: Piece = { square: from, color: "white", type: "pawn" };

  const diagonalEnemy: Board = {
    size: 8,
    pieces: [mover, { square: { file: 5, rank: 4 }, color: "black", type: "pawn" }],
  };
  const movesEnemy = pawnMoves(from, diagonalEnemy);
  checkIncludes("diagonal with enemy is legal", movesEnemy, { file: 5, rank: 4 });

  const diagonalFriendly: Board = {
    size: 8,
    pieces: [mover, { square: { file: 5, rank: 4 }, color: "white", type: "pawn" }],
  };
  const movesFriendly = pawnMoves(from, diagonalFriendly);
  checkExcludes("diagonal with friendly is not legal", movesFriendly, { file: 5, rank: 4 });

  const diagonalEmpty: Board = { size: 8, pieces: [mover] };
  const movesEmpty = pawnMoves(from, diagonalEmpty);
  checkExcludes("diagonal with nothing is not legal", movesEmpty, { file: 5, rank: 4 });
}

// ---- empty from-square (gap 3) ----
// No piece stands at `from` in any of these boards, so every function
// should return [] rather than generating moves for a piece that isn't
// there.
console.log("\nempty from-square");
{
  const from: Square = { file: 4, rank: 4 };
  const somewhereElse: Board = {
    size: 8,
    pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "pawn" }],
  };

  check("kingMoves on empty square", kingMoves(from, somewhereElse), 0);
  check("knightMoves on empty square", knightMoves(from, somewhereElse), 0);
  check("rookMoves on empty square", rookMoves(from, somewhereElse), 0);
  check("bishopMoves on empty square", bishopMoves(from, somewhereElse), 0);
  check("queenMoves on empty square", queenMoves(from, somewhereElse), 0);
  check("pawnMoves on empty square", pawnMoves(from, somewhereElse), 0);

  const totallyEmpty: Board = { size: 8, pieces: [] };
  check("kingMoves on totally empty board", kingMoves(from, totallyEmpty), 0);
  check("rookMoves on totally empty board", rookMoves(from, totallyEmpty), 0);
}

// ---- movesFrom dispatch ----
// movesFrom must produce exactly the destinations of the piece's own
// function — it wraps them, it does not recompute them.
console.log("\nmovesFrom dispatch");
{
  const sameSquares = (moves: Move[], squares: Square[]): boolean =>
    moves.length === squares.length &&
    squares.every(sq => moves.some(m => m.to.file === sq.file && m.to.rank === sq.rank)) &&
    moves.every(m => squares.some(sq => m.to.file === sq.file && m.to.rank === sq.rank));

  function checkDispatch(label: string, moves: Move[], squares: Square[]) {
    if (sameSquares(moves, squares)) {
      console.log(`  PASS  ${label}  (${squares.length} destinations match)`);
      passed++;
    } else {
      console.log(`  FAIL  ${label}  destinations differ`);
      console.log(`        movesFrom: ${JSON.stringify(moves.map(m => m.to))}`);
      console.log(`        direct:    ${JSON.stringify(squares)}`);
      failed++;
    }
  }

  function checkEchoesFrom(label: string, from: Square, moves: Move[]) {
    const allEcho = moves.every(m => m.from.file === from.file && m.from.rank === from.rank);
    if (allEcho && moves.length > 0) {
      console.log(`  PASS  ${label}  (${moves.length} moves echo from)`);
      passed++;
    } else if (moves.length === 0) {
      console.log(`  FAIL  ${label}  no moves generated, echo untested`);
      failed++;
    } else {
      console.log(`  FAIL  ${label}  some moves do not echo from`);
      console.log(`        ${JSON.stringify(moves)}`);
      failed++;
    }
  }

  // One crowded board, every piece type on it, so dispatch is tested
  // against neighbours rather than in isolation.
  const board: Board = {
    size: 8,
    pieces: [
      { square: { file: 4, rank: 0 }, color: "white", type: "king" },
      { square: { file: 3, rank: 3 }, color: "white", type: "queen" },
      { square: { file: 0, rank: 2 }, color: "white", type: "rook" },
      { square: { file: 2, rank: 0 }, color: "white", type: "bishop" },
      { square: { file: 6, rank: 0 }, color: "white", type: "knight" },
      { square: { file: 5, rank: 1 }, color: "white", type: "pawn" },
      { square: { file: 4, rank: 2 }, color: "black", type: "pawn" },
      { square: { file: 7, rank: 5 }, color: "black", type: "rook" },
    ],
  };

  const kingFrom: Square = { file: 4, rank: 0 };
  checkDispatch("dispatches king", movesFrom(kingFrom, board), kingMoves(kingFrom, board));
  checkEchoesFrom("king moves echo from", kingFrom, movesFrom(kingFrom, board));

  const queenFrom: Square = { file: 3, rank: 3 };
  checkDispatch("dispatches queen", movesFrom(queenFrom, board), queenMoves(queenFrom, board));
  checkEchoesFrom("queen moves echo from", queenFrom, movesFrom(queenFrom, board));

  const rookFrom: Square = { file: 0, rank: 2 };
  checkDispatch("dispatches rook", movesFrom(rookFrom, board), rookMoves(rookFrom, board));
  checkEchoesFrom("rook moves echo from", rookFrom, movesFrom(rookFrom, board));

  const bishopFrom: Square = { file: 2, rank: 0 };
  checkDispatch("dispatches bishop", movesFrom(bishopFrom, board), bishopMoves(bishopFrom, board));
  checkEchoesFrom("bishop moves echo from", bishopFrom, movesFrom(bishopFrom, board));

  const knightFrom: Square = { file: 6, rank: 0 };
  checkDispatch("dispatches knight", movesFrom(knightFrom, board), knightMoves(knightFrom, board));
  checkEchoesFrom("knight moves echo from", knightFrom, movesFrom(knightFrom, board));

  const whitePawnFrom: Square = { file: 5, rank: 1 };
  checkDispatch("dispatches white pawn", movesFrom(whitePawnFrom, board), pawnMoves(whitePawnFrom, board));
  checkEchoesFrom("white pawn moves echo from", whitePawnFrom, movesFrom(whitePawnFrom, board));

  // Black pawn too: direction is read from the board, not passed in, so
  // dispatch must not smuggle a colour assumption.
  const blackPawnFrom: Square = { file: 4, rank: 2 };
  checkDispatch("dispatches black pawn", movesFrom(blackPawnFrom, board), pawnMoves(blackPawnFrom, board));
  checkEchoesFrom("black pawn moves echo from", blackPawnFrom, movesFrom(blackPawnFrom, board));

  // A black non-pawn as well, so dispatch is not only exercised on white.
  const blackRookFrom: Square = { file: 7, rank: 5 };
  checkDispatch("dispatches black rook", movesFrom(blackRookFrom, board), rookMoves(blackRookFrom, board));
  checkEchoesFrom("black rook moves echo from", blackRookFrom, movesFrom(blackRookFrom, board));
}

// ---- movesFrom on an empty square ----
console.log("\nmovesFrom empty from-square");
{
  function checkEmpty(label: string, moves: Move[]) {
    if (moves.length === 0) {
      console.log(`  PASS  ${label}  (0)`);
      passed++;
    } else {
      console.log(`  FAIL  ${label}  expected 0, got ${moves.length}`);
      console.log(`        ${JSON.stringify(moves)}`);
      failed++;
    }
  }

  const occupiedElsewhere: Board = {
    size: 8,
    pieces: [
      { square: { file: 0, rank: 0 }, color: "white", type: "rook" },
      { square: { file: 7, rank: 7 }, color: "black", type: "king" },
    ],
  };
  checkEmpty("empty square amid other pieces", movesFrom({ file: 4, rank: 4 }, occupiedElsewhere));

  const totallyEmpty: Board = { size: 8, pieces: [] };
  checkEmpty("empty square on empty board", movesFrom({ file: 4, rank: 4 }, totallyEmpty));
}

// ---- movesFrom carries no dimension assumptions ----
// Tier 1 lessons use 5x5 boards; dispatch must read board.size like
// everything else.
console.log("\nmovesFrom on a 5x5 board");
{
  const small: Board = {
    size: 5,
    pieces: [{ square: { file: 2, rank: 2 }, color: "white", type: "rook" }],
  };
  const from: Square = { file: 2, rank: 2 };
  const moves = movesFrom(from, small);

  const direct = rookMoves(from, small);
  if (moves.length === direct.length && moves.length === 8) {
    console.log(`  PASS  5x5 rook matches direct call  (8)`);
    passed++;
  } else {
    console.log(`  FAIL  5x5 rook expected 8, got ${moves.length} (direct ${direct.length})`);
    failed++;
  }

  const onBoard5 = moves.every(m =>
    m.to.file >= 0 && m.to.file < small.size && m.to.rank >= 0 && m.to.rank < small.size);
  if (onBoard5) {
    console.log(`  PASS  5x5 destinations all on board`);
    passed++;
  } else {
    console.log(`  FAIL  5x5 destinations left the board  ${JSON.stringify(moves.map(m => m.to))}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
