import {
  kingMoves, knightMoves, rookMoves,
  bishopMoves, queenMoves, pawnMoves,
} from "./moves.js";
import type { Square, Board } from "./moves.js";

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

  const diagonalEnemy: Board = {
    size: 8,
    pieces: [{ square: { file: 5, rank: 4 }, color: "black", type: "pawn" }],
  };
  const movesEnemy = pawnMoves(from, diagonalEnemy, "white");
  checkIncludes("diagonal with enemy is legal", movesEnemy, { file: 5, rank: 4 });

  const diagonalFriendly: Board = {
    size: 8,
    pieces: [{ square: { file: 5, rank: 4 }, color: "white", type: "pawn" }],
  };
  const movesFriendly = pawnMoves(from, diagonalFriendly, "white");
  checkExcludes("diagonal with friendly is not legal", movesFriendly, { file: 5, rank: 4 });

  const diagonalEmpty: Board = { size: 8, pieces: [] };
  const movesEmpty = pawnMoves(from, diagonalEmpty, "white");
  checkExcludes("diagonal with nothing is not legal", movesEmpty, { file: 5, rank: 4 });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
