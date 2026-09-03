import {
  kingMoves, knightMoves, rookMoves,
  bishopMoves, queenMoves, pawnMoves,
  Square, Board,
} from "./moves";

const empty: Board = { size: 8, occupied: [] };

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
check("centre", kingMoves({ file: 4, rank: 4 }, empty), 8);
check("corner", kingMoves({ file: 0, rank: 0 }, empty), 3);
check("edge",   kingMoves({ file: 0, rank: 4 }, empty), 5);

console.log("\nknight");
check("centre", knightMoves({ file: 4, rank: 4 }, empty), 8);
check("corner", knightMoves({ file: 0, rank: 0 }, empty), 2);
check("near corner", knightMoves({ file: 1, rank: 1 }, empty), 4);

console.log("\nrook");
check("centre", rookMoves({ file: 4, rank: 4 }, empty), 14);
check("corner", rookMoves({ file: 0, rank: 0 }, empty), 14);
check("blocked", rookMoves({ file: 0, rank: 0 },
  { size: 8, occupied: [{ file: 0, rank: 3 }] }), 9);

console.log("\nbishop");
check("centre", bishopMoves({ file: 4, rank: 4 }, empty), 13);
check("corner", bishopMoves({ file: 0, rank: 0 }, empty), 7);
check("edge",   bishopMoves({ file: 2, rank: 0 }, empty), 7);

console.log("\nqueen");
check("centre", queenMoves({ file: 4, rank: 4 }, empty), 27);
check("corner", queenMoves({ file: 0, rank: 0 }, empty), 21);

console.log("\npawn");
check("white start",   pawnMoves({ file: 4, rank: 1 }, empty, "white"), 2);
check("white mid",     pawnMoves({ file: 4, rank: 3 }, empty, "white"), 1);
check("black start",   pawnMoves({ file: 4, rank: 6 }, empty, "black"), 2);
check("black mid",     pawnMoves({ file: 4, rank: 4 }, empty, "black"), 1);
check("blocked",       pawnMoves({ file: 4, rank: 1 },
  { size: 8, occupied: [{ file: 4, rank: 2 }] }, "white"), 0);
check("blocked at two", pawnMoves({ file: 4, rank: 1 },
  { size: 8, occupied: [{ file: 4, rank: 3 }] }, "white"), 1);
check("capture",       pawnMoves({ file: 0, rank: 3 },
  { size: 8, occupied: [{ file: 1, rank: 4 }] }, "white"), 2);
check("no wrap",       pawnMoves({ file: 0, rank: 3 }, empty, "white"), 1);
check("last rank",     pawnMoves({ file: 4, rank: 7 }, empty, "white"), 0);

console.log("\nsmall board");
check("5x5 king centre",  kingMoves({ file: 2, rank: 2 }, { size: 5, occupied: [] }), 8);
check("5x5 rook centre",  rookMoves({ file: 2, rank: 2 }, { size: 5, occupied: [] }), 8);

console.log(`\n${passed} passed, ${failed} failed\n`);