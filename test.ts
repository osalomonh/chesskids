import {
  kingMoves, knightMoves, rookMoves,
  bishopMoves, queenMoves, pawnMoves,
} from "./moves.js";
import type { Square } from "./moves.js";

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

console.log("\nking");
check("centre", kingMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "white", type: "king" }] }), 8);
check("corner", kingMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "king" }] }), 3);
check("edge",   kingMoves({ file: 0, rank: 4 },
  { size: 8, pieces: [{ square: { file: 0, rank: 4 }, color: "white", type: "king" }] }), 5);

console.log("\nknight");
check("centre", knightMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "white", type: "knight" }] }), 8);
check("corner", knightMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "knight" }] }), 2);
check("near corner", knightMoves({ file: 1, rank: 1 },
  { size: 8, pieces: [{ square: { file: 1, rank: 1 }, color: "white", type: "knight" }] }), 4);

console.log("\nrook");
check("centre", rookMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "white", type: "rook" }] }), 14);
check("corner", rookMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "rook" }] }), 14);
check("blocked", rookMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [
    { square: { file: 0, rank: 0 }, color: "white", type: "rook" },
    { square: { file: 0, rank: 3 }, color: "white", type: "pawn" },
  ] }), 9);

console.log("\nbishop");
check("centre", bishopMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "white", type: "bishop" }] }), 13);
check("corner", bishopMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "bishop" }] }), 7);
check("edge",   bishopMoves({ file: 2, rank: 0 },
  { size: 8, pieces: [{ square: { file: 2, rank: 0 }, color: "white", type: "bishop" }] }), 7);

console.log("\nqueen");
check("centre", queenMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "white", type: "queen" }] }), 27);
check("corner", queenMoves({ file: 0, rank: 0 },
  { size: 8, pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "queen" }] }), 21);

console.log("\npawn");
check("white start",   pawnMoves({ file: 4, rank: 1 },
  { size: 8, pieces: [{ square: { file: 4, rank: 1 }, color: "white", type: "pawn" }] }), 2);
check("white mid",     pawnMoves({ file: 4, rank: 3 },
  { size: 8, pieces: [{ square: { file: 4, rank: 3 }, color: "white", type: "pawn" }] }), 1);
check("black start",   pawnMoves({ file: 4, rank: 6 },
  { size: 8, pieces: [{ square: { file: 4, rank: 6 }, color: "black", type: "pawn" }] }), 2);
check("black mid",     pawnMoves({ file: 4, rank: 4 },
  { size: 8, pieces: [{ square: { file: 4, rank: 4 }, color: "black", type: "pawn" }] }), 1);
check("blocked",       pawnMoves({ file: 4, rank: 1 },
  { size: 8, pieces: [
    { square: { file: 4, rank: 1 }, color: "white", type: "pawn" },
    { square: { file: 4, rank: 2 }, color: "white", type: "pawn" },
  ] }), 0);
check("blocked at two", pawnMoves({ file: 4, rank: 1 },
  { size: 8, pieces: [
    { square: { file: 4, rank: 1 }, color: "white", type: "pawn" },
    { square: { file: 4, rank: 3 }, color: "white", type: "pawn" },
  ] }), 1);
check("capture",       pawnMoves({ file: 0, rank: 3 },
  { size: 8, pieces: [
    { square: { file: 0, rank: 3 }, color: "white", type: "pawn" },
    { square: { file: 1, rank: 4 }, color: "black", type: "pawn" },
  ] }), 2);
check("no wrap",       pawnMoves({ file: 0, rank: 3 },
  { size: 8, pieces: [{ square: { file: 0, rank: 3 }, color: "white", type: "pawn" }] }), 1);
check("last rank",     pawnMoves({ file: 4, rank: 7 },
  { size: 8, pieces: [{ square: { file: 4, rank: 7 }, color: "white", type: "pawn" }] }), 0);

console.log("\nsmall board");
check("5x5 king centre",  kingMoves({ file: 2, rank: 2 },
  { size: 5, pieces: [{ square: { file: 2, rank: 2 }, color: "white", type: "king" }] }), 8);
check("5x5 rook centre",  rookMoves({ file: 2, rank: 2 },
  { size: 5, pieces: [{ square: { file: 2, rank: 2 }, color: "white", type: "rook" }] }), 8);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;