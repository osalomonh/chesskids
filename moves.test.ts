import { test } from "node:test";
import assert from "node:assert";
import { knightMoves, rookMoves, bishopMoves, queenMoves, kingMoves, pawnMoves} from "./moves.js";
import type { Square, Board } from "./moves.js";

const empty: Board = { size: 8, pieces: [] };
const sorted = (squares: Square[]) =>
  [...squares].sort((a, b) => a.file - b.file || a.rank - b.rank);

test("knight in the corner reaches exactly b3 and c2", () => {
  assert.deepStrictEqual(
    sorted(knightMoves({ file: 0, rank: 0 }, empty)),
    sorted([{ file: 1, rank: 2 }, { file: 2, rank: 1 }])
  );
});

test("knight in the center reaches its 8 valid moves", () => {
  assert.deepStrictEqual(
    sorted(knightMoves({ file: 3, rank: 3 }, empty)),
    sorted([{ file: 4, rank:  5}, { file: 5, rank: 4 }, { file: 2, rank: 5 }, { file: 1, rank: 4}, 
      { file: 2, rank: 1}, { file: 1, rank: 2}, { file: 4, rank: 1}, { file: 5, rank: 2}])
  );
});

test("rook in the corner reaches the full file and rank", () => {
  const moves = rookMoves({ file: 0, rank: 0 }, empty);
  assert.strictEqual(moves.length, 14);
  assert.ok(moves.every(m => m.file === 0 || m.rank === 0));
});
