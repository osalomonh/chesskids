import { test } from "node:test";
import assert from "node:assert";
import { knightMoves, rookMoves, bishopMoves, queenMoves, kingMoves, pawnMoves} from "./moves.js";
import type { Square, Board } from "./moves.js";

const sorted = (squares: Square[]) =>
  [...squares].sort((a, b) => a.file - b.file || a.rank - b.rank);

test("knight in the corner reaches exactly b3 and c2", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "knight" }],
  };
  assert.deepStrictEqual(
    sorted(knightMoves({ file: 0, rank: 0 }, board)),
    sorted([{ file: 1, rank: 2 }, { file: 2, rank: 1}])
  );
});

test("knight in the center reaches its 8 valid moves", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: { file: 3, rank: 3 }, color: "white", type: "knight" }],
  };
  assert.deepStrictEqual(
    sorted(knightMoves({ file: 3, rank: 3 }, board)),
    sorted([{ file: 4, rank:  5}, { file: 5, rank: 4 }, { file: 2, rank: 5 }, { file: 1, rank: 4},
      { file: 2, rank: 1}, { file: 1, rank: 2}, { file: 4, rank: 1}, { file: 5, rank: 2}])
  );
});

test("rook in the corner reaches the full file and rank", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: { file: 0, rank: 0 }, color: "white", type: "rook" }],
  };
  const moves = rookMoves({ file: 0, rank: 0 }, board);
  assert.strictEqual(moves.length, 14);
  assert.ok(moves.every(m => m.file === 0 || m.rank === 0));
});
