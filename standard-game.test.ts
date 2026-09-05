import { test } from "node:test";
import assert from "node:assert";
import {
  applyMove,
  gameFromFen,
  gameStatus,
  isGameOver,
  isInCheck,
  lastMove,
  legalMoves,
  legalMovesFrom,
  newGame,
  pieceAt,
  sideToMove,
  squareFromName,
  squareName,
} from "./standard-game.js";
import type {
  MoveRejection,
  PromotionPiece,
  StandardGame,
  StandardMove,
} from "./standard-game.js";
import type { Square } from "./moves.js";

// --- helpers --------------------------------------------------------------

const sq = squareFromName;

/** Apply a run of long-algebraic moves ("e2e4", "e7e8q"), asserting each one. */
function play(game: StandardGame, ...moves: string[]): StandardGame {
  let current = game;
  for (const text of moves) {
    const promotion = PROMOTIONS[text.slice(4, 5)];
    const move: StandardMove = {
      from: sq(text.slice(0, 2)),
      to: sq(text.slice(2, 4)),
      ...(promotion === undefined ? {} : { promotion }),
    };
    const result = applyMove(current, move);
    assert.ok(result.ok, `${text} rejected: ${result.ok ? "" : result.reason}`);
    current = result.game;
  }
  return current;
}

const PROMOTIONS: Record<string, PromotionPiece | undefined> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

function rejection(game: StandardGame, move: StandardMove): MoveRejection {
  const result = applyMove(game, move);
  assert.equal(result.ok, false, "expected the move to be rejected");
  return result.ok ? ("illegal-move" as MoveRejection) : result.reason;
}

function allSquares(size: number): Square[] {
  const squares: Square[] = [];
  for (let rank = 0; rank < size; rank += 1) {
    for (let file = 0; file < size; file += 1) squares.push({ file, rank });
  }
  return squares;
}

// --- start position -------------------------------------------------------

test("a new game is the standard start, white to move", () => {
  const game = newGame();
  assert.equal(game.board.size, 8);
  assert.equal(game.board.pieces.length, 32);
  assert.equal(game.sideToMove, "white");
  assert.equal(sideToMove(game), "white");
  assert.deepStrictEqual(game.history, []);
  assert.equal(lastMove(game), null);
});

test("the white king starts on e1 = {file: 4, rank: 0}", () => {
  const game = newGame();
  assert.deepStrictEqual(pieceAt(game, { file: 4, rank: 0 }), {
    square: { file: 4, rank: 0 },
    color: "white",
    type: "king",
  });
  assert.deepStrictEqual(pieceAt(game, sq("e8")), {
    square: { file: 4, rank: 7 },
    color: "black",
    type: "king",
  });
  assert.equal(pieceAt(game, sq("e4")), undefined);
  assert.equal(pieceAt(game, { file: 8, rank: 0 }), undefined);
});

test("the start position has 20 legal moves, per square and in total", () => {
  const game = newGame();
  assert.equal(legalMoves(game).length, 20);

  const perSquare = allSquares(game.board.size).reduce(
    (total, square) => total + legalMovesFrom(game, square).length,
    0,
  );
  assert.equal(perSquare, 20);

  assert.equal(legalMovesFrom(game, sq("e2")).length, 2);
});

test("legalMovesFrom is empty for an empty square, a black piece, and off the board", () => {
  const game = newGame();
  assert.deepStrictEqual(legalMovesFrom(game, sq("e4")), []);
  assert.deepStrictEqual(legalMovesFrom(game, sq("e7")), []);
  assert.deepStrictEqual(legalMovesFrom(game, { file: -1, rank: 0 }), []);
  assert.deepStrictEqual(legalMovesFrom(game, { file: 0, rank: 8 }), []);
});

// --- applying -------------------------------------------------------------

test("applying e2e4 moves the pawn, flips the side, and records the move", () => {
  const game = newGame();
  const result = applyMove(game, { from: sq("e2"), to: sq("e4") });
  assert.ok(result.ok);
  const next = result.game;

  assert.equal(next.sideToMove, "black");
  assert.equal(pieceAt(next, sq("e2")), undefined);
  assert.deepStrictEqual(pieceAt(next, sq("e4")), {
    square: { file: 4, rank: 3 },
    color: "white",
    type: "pawn",
  });
  assert.deepStrictEqual(next.history, ["e2e4"]);
  assert.deepStrictEqual(lastMove(next), { from: sq("e2"), to: sq("e4") });
  assert.equal(next.board.pieces.length, 32);
});

test("applyMove does not touch the game it was given", () => {
  const game = newGame();
  const before = structuredClone(game);
  const result = applyMove(game, { from: sq("e2"), to: sq("e4") });
  assert.ok(result.ok);
  assert.deepStrictEqual(game, before);
  assert.notEqual(result.game, game);
  assert.notEqual(result.game.board, game.board);
});

test("a capture reports what it took", () => {
  const game = gameFromFen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
  const capture = legalMovesFrom(game, sq("e4")).find(
    (move) => move.to.file === sq("d5").file && move.to.rank === sq("d5").rank,
  );
  assert.deepStrictEqual(capture, {
    from: sq("e4"),
    to: sq("d5"),
    captures: "pawn",
  });

  const played = play(game, "e4d5");
  assert.equal(played.board.pieces.length, 3);
  assert.equal(pieceAt(played, sq("e4")), undefined);
});

test("lastMove reports the capture on a game played from the start", () => {
  const game = play(newGame(), "e2e4", "d7d5", "e4d5");
  assert.deepStrictEqual(lastMove(game), {
    from: sq("e4"),
    to: sq("d5"),
    captures: "pawn",
  });
});

test("lastMove on a game set up from a FEN gives from and to, without captures", () => {
  // A game built by gameFromFen has no history reaching back to the standard
  // start, so chess.js cannot be replayed to recover what a move took. The
  // squares are still exact, which is what highlighting needs.
  const game = play(gameFromFen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1"), "e4d5");
  assert.deepStrictEqual(lastMove(game), { from: sq("e4"), to: sq("d5") });
});

// --- rejections -----------------------------------------------------------

test("moves off the board are rejected", () => {
  const game = newGame();
  assert.equal(rejection(game, { from: { file: 8, rank: 0 }, to: sq("e4") }), "off-board");
  assert.equal(rejection(game, { from: sq("e2"), to: { file: 4, rank: 8 } }), "off-board");
  assert.equal(rejection(game, { from: { file: -1, rank: 1 }, to: sq("e4") }), "off-board");
  assert.equal(rejection(game, { from: { file: 4.5, rank: 1 }, to: sq("e4") }), "off-board");
});

test("an empty from-square is rejected", () => {
  assert.equal(rejection(newGame(), { from: sq("e4"), to: sq("e5") }), "empty-square");
});

test("moving the other side's piece is rejected", () => {
  assert.equal(rejection(newGame(), { from: sq("e7"), to: sq("e5") }), "wrong-side");
});

test("an illegal move is rejected", () => {
  const game = newGame();
  assert.equal(rejection(game, { from: sq("e2"), to: sq("e5") }), "illegal-move");
  assert.equal(rejection(game, { from: sq("e1"), to: sq("e2") }), "illegal-move");
  assert.equal(rejection(game, { from: sq("e2"), to: sq("e2") }), "illegal-move");
});

// --- castling -------------------------------------------------------------

test("white can castle kingside, and the rook comes with the king", () => {
  const opening = play(newGame(), "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5");

  const kingMoves = legalMovesFrom(opening, sq("e1"));
  assert.ok(
    kingMoves.some((move) => move.to.file === 6 && move.to.rank === 0),
    "e1-g1 should be offered",
  );

  const castled = play(opening, "e1g1");
  assert.deepStrictEqual(pieceAt(castled, sq("g1")), {
    square: sq("g1"),
    color: "white",
    type: "king",
  });
  assert.deepStrictEqual(pieceAt(castled, sq("f1")), {
    square: sq("f1"),
    color: "white",
    type: "rook",
  });
  assert.equal(pieceAt(castled, sq("e1")), undefined);
  assert.equal(pieceAt(castled, sq("h1")), undefined);
  assert.deepStrictEqual(castled.history.at(-1), "e1g1");
});

// --- en passant -----------------------------------------------------------

test("en passant is offered, captures a pawn, and lands on an empty square", () => {
  const game = play(newGame(), "e2e4", "a7a6", "e4e5", "d7d5");

  const enPassant = legalMovesFrom(game, sq("e5")).find(
    (move) => move.to.file === 3 && move.to.rank === 5,
  );
  assert.deepStrictEqual(enPassant, {
    from: sq("e5"),
    to: sq("d6"),
    captures: "pawn",
  });
  assert.equal(pieceAt(game, sq("d6")), undefined, "the landing square is empty");

  const taken = play(game, "e5d6");
  assert.equal(pieceAt(taken, sq("d5")), undefined, "the black pawn is gone");
  assert.deepStrictEqual(pieceAt(taken, sq("d6")), {
    square: sq("d6"),
    color: "white",
    type: "pawn",
  });
  assert.equal(taken.board.pieces.length, 31);
});

// --- promotion ------------------------------------------------------------

test("a promoting pawn offers four moves to the same square", () => {
  const game = gameFromFen("8/4P3/8/8/8/8/8/k6K w - - 0 1");
  const moves = legalMovesFrom(game, sq("e7"));

  assert.equal(moves.length, 4);
  assert.ok(moves.every((move) => move.to.file === 4 && move.to.rank === 7));
  assert.deepStrictEqual(
    moves.map((move) => move.promotion).sort(),
    ["bishop", "knight", "queen", "rook"],
  );
});

test("promoting to a queen puts a white queen on e8", () => {
  const game = gameFromFen("8/4P3/8/8/8/8/8/k6K w - - 0 1");
  const result = applyMove(game, {
    from: sq("e7"),
    to: sq("e8"),
    promotion: "queen",
  });
  assert.ok(result.ok);
  assert.deepStrictEqual(pieceAt(result.game, sq("e8")), {
    square: sq("e8"),
    color: "white",
    type: "queen",
  });
  assert.deepStrictEqual(result.game.history, ["e7e8q"]);
  assert.deepStrictEqual(lastMove(result.game), {
    from: sq("e7"),
    to: sq("e8"),
    promotion: "queen",
  });
});

test("a promotion move without its promotion field is illegal", () => {
  const game = gameFromFen("8/4P3/8/8/8/8/8/k6K w - - 0 1");
  assert.equal(rejection(game, { from: sq("e7"), to: sq("e8") }), "illegal-move");
});

// --- status ---------------------------------------------------------------

test("a plain position is playing and not over", () => {
  const game = newGame();
  assert.equal(gameStatus(game), "playing");
  assert.equal(isGameOver(game), false);
  assert.equal(isInCheck(game), false);
});

test("an attacked king to move is check", () => {
  const game = gameFromFen("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1");
  assert.equal(isInCheck(game), true);
  assert.equal(gameStatus(game), "check");
  assert.equal(isGameOver(game), false);
  assert.ok(legalMoves(game).length > 0);
});

test("fool's mate is checkmate, and nothing more can be played", () => {
  const game = play(newGame(), "f2f3", "e7e5", "g2g4", "d8h4");
  assert.equal(gameStatus(game), "checkmate");
  assert.equal(isGameOver(game), true);
  assert.equal(isInCheck(game), true);
  assert.equal(rejection(game, { from: sq("e1"), to: sq("e2") }), "game-over");
  assert.deepStrictEqual(legalMoves(game), []);
  assert.deepStrictEqual(legalMovesFrom(game, sq("e1")), []);
});

test("a king with no move and no check is stalemate", () => {
  const game = gameFromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(gameStatus(game), "stalemate");
  assert.equal(isGameOver(game), true);
  assert.equal(isInCheck(game), false);
  assert.equal(rejection(game, { from: sq("h8"), to: sq("h7") }), "game-over");
});

test("king against king is insufficient material", () => {
  const game = gameFromFen("8/8/8/4k3/8/8/8/4K3 w - - 0 1");
  assert.equal(gameStatus(game), "insufficient-material");
  assert.equal(isGameOver(game), true);
});

test("a hundred half-moves without a pawn or a capture is a fifty-move draw", () => {
  const game = gameFromFen("4k3/8/8/8/8/8/4P3/R3K2R w KQ - 100 60");
  assert.equal(gameStatus(game), "fifty-move-draw");
  assert.equal(isGameOver(game), true);
});

test("the same position three times is a repetition draw", () => {
  const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
  const once = play(newGame(), ...cycle);
  assert.equal(gameStatus(once), "playing", "twice is not enough");

  const twice = play(once, ...cycle);
  assert.deepStrictEqual(twice.history, [...cycle, ...cycle]);
  assert.equal(gameStatus(twice), "repetition-draw");
  assert.equal(isGameOver(twice), true);
  assert.deepStrictEqual(legalMoves(twice), []);
  assert.equal(rejection(twice, { from: sq("e2"), to: sq("e4") }), "game-over");
});

// --- square names ---------------------------------------------------------

test("squareName and squareFromName round trip for all 64 squares", () => {
  assert.equal(squareName({ file: 4, rank: 1 }), "e2");
  assert.deepStrictEqual(squareFromName("e2"), { file: 4, rank: 1 });
  assert.equal(squareName({ file: 0, rank: 0 }), "a1");
  assert.equal(squareName({ file: 7, rank: 7 }), "h8");

  const squares = allSquares(newGame().board.size);
  assert.equal(squares.length, 64);
  for (const square of squares) {
    assert.deepStrictEqual(squareFromName(squareName(square)), square);
  }
});
