import { test } from "node:test";
import assert from "node:assert";
import {
  applyMove,
  gameStatus,
  isInCheck,
  isRepetitionDraw,
  legalMovesFrom,
  sideToMove,
} from "./game.js";
import type {
  CastlingRights,
  GameState,
  GameStatus,
  MoveRejection,
  MoveResult,
  PositionKey,
} from "./game.js";
import { movesFrom } from "./moves.js";
import type { Board, Color, Move, Piece, Square } from "./moves.js";

// --- fixtures -------------------------------------------------------------

const ALL_RIGHTS: CastlingRights = {
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
};

const NO_RIGHTS: CastlingRights = {
  whiteKingside: false,
  whiteQueenside: false,
  blackKingside: false,
  blackQueenside: false,
};

function makeState(
  board: Board,
  sideToMove: Color = "white",
  castling: CastlingRights = ALL_RIGHTS,
  enPassantTarget: Square | null = null,
  history: PositionKey[] = []
): GameState {
  return { board, sideToMove, castling, enPassantTarget, history };
}

const at = (file: number, rank: number): Square => ({ file, rank });

// --- result unwrapping ----------------------------------------------------
// Rejection is a value, so a test has to unwrap it. `throw` rather than
// assert.fail so control-flow narrowing works.

function expectOk(result: MoveResult): GameState {
  if (!result.ok) {
    throw new Error(`expected success, got rejection: ${result.reason}`);
  }
  return result.state;
}

function expectRejected(result: MoveResult, reason: MoveRejection): void {
  if (result.ok) {
    throw new Error(`expected rejection '${reason}', got a new state`);
  }
  assert.strictEqual(result.reason, reason);
}

const pieceOn = (board: Board, square: Square): Piece | undefined =>
  board.pieces.find(
    p => p.square.file === square.file && p.square.rank === square.rank
  );

function lastKey(state: GameState): PositionKey {
  const key = state.history[state.history.length - 1];
  if (key === undefined) {
    throw new Error("history is empty");
  }
  return key;
}

// --- success path ---------------------------------------------------------

test("a legal move moves the piece, flips the side, and grows history", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };
  const before = makeState(board);

  const next = expectOk(applyMove(before, { from: at(1, 0), to: at(2, 2) }));

  assert.strictEqual(pieceOn(next.board, at(1, 0)), undefined);
  assert.deepStrictEqual(pieceOn(next.board, at(2, 2)), {
    square: at(2, 2),
    color: "white",
    type: "knight",
  });
  assert.strictEqual(next.sideToMove, "black");
  assert.strictEqual(next.history.length, before.history.length + 1);
  assert.strictEqual(next.board.size, before.board.size);
  assert.strictEqual(next.board.pieces.length, before.board.pieces.length);
});

test("the input state, its board, and its pieces come back untouched", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(0, 6), color: "black", type: "pawn" },
    ],
  };
  const before = makeState(board, "white", ALL_RIGHTS, null, ["seeded-key"]);
  const snapshot = structuredClone(before);
  const originalKnight = before.board.pieces[0];

  const next = expectOk(applyMove(before, { from: at(1, 0), to: at(2, 2) }));

  // Value-identical to what went in.
  assert.deepStrictEqual(before, snapshot);
  // And nothing in the new state shares an identity with the old one.
  assert.notStrictEqual(next, before);
  assert.notStrictEqual(next.board, before.board);
  assert.notStrictEqual(next.board.pieces, before.board.pieces);
  assert.notStrictEqual(next.history, before.history);
  assert.deepStrictEqual(originalKnight?.square, at(1, 0));
  for (const piece of next.board.pieces) {
    assert.ok(
      !before.board.pieces.includes(piece),
      "new board reuses a piece object from the old board"
    );
  }
});

test("history is appended to, not replaced", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const before = makeState(board, "white", NO_RIGHTS, null, ["k1", "k2"]);

  const next = expectOk(applyMove(before, { from: at(1, 0), to: at(2, 2) }));

  assert.deepStrictEqual(next.history.slice(0, 2), ["k1", "k2"]);
  assert.strictEqual(next.history.length, 3);
  assert.deepStrictEqual(before.history, ["k1", "k2"]);
});

// --- rejection paths ------------------------------------------------------

test("rejects 'off-board' when the destination is off the board", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(0, 0), color: "white", type: "knight" }],
  };
  const before = makeState(board);
  const snapshot = structuredClone(before);

  expectRejected(applyMove(before, { from: at(0, 0), to: at(-1, 2) }), "off-board");
  expectRejected(applyMove(before, { from: at(0, 0), to: at(8, 0) }), "off-board");
  assert.deepStrictEqual(before, snapshot);
});

test("rejects 'off-board' when the origin is off the board, before looking for a piece", () => {
  const board: Board = { size: 8, pieces: [] };
  const before = makeState(board);

  // The origin is both off-board and empty. Order in §10 puts off-board first.
  expectRejected(applyMove(before, { from: at(9, 9), to: at(0, 0) }), "off-board");
});

test("rejects 'off-board' on a 5x5 board for a square an 8x8 board would allow", () => {
  const board: Board = {
    size: 5,
    pieces: [{ square: at(2, 2), color: "white", type: "rook" }],
  };
  const before = makeState(board, "white", NO_RIGHTS);

  expectRejected(applyMove(before, { from: at(2, 2), to: at(6, 2) }), "off-board");
});

test("rejects 'empty-square' when the origin holds no piece", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(4, 0), color: "white", type: "king" }],
  };
  const before = makeState(board);
  const snapshot = structuredClone(before);

  expectRejected(applyMove(before, { from: at(3, 3), to: at(3, 4) }), "empty-square");
  assert.deepStrictEqual(before, snapshot);
});

test("rejects 'wrong-side' when the piece belongs to the other player", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };
  const before = makeState(board, "white");
  const snapshot = structuredClone(before);

  // b8-c6 is a perfectly legal knight move. It is just not white's to make.
  expectRejected(applyMove(before, { from: at(1, 7), to: at(2, 5) }), "wrong-side");
  assert.deepStrictEqual(before, snapshot);
});

test("rejects 'wrong-side' symmetrically when it is black to move", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };
  const before = makeState(board, "black");

  expectRejected(applyMove(before, { from: at(1, 0), to: at(2, 2) }), "wrong-side");
});

test("rejects 'illegal-move' when moves.ts did not generate the move", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(0, 0), color: "white", type: "rook" }],
  };
  const before = makeState(board);
  const snapshot = structuredClone(before);

  // On the board, correct colour, correct turn — but a rook does not go there.
  expectRejected(applyMove(before, { from: at(0, 0), to: at(1, 1) }), "illegal-move");
  assert.deepStrictEqual(before, snapshot);
});

test("rejects 'illegal-move' for a friendly-occupied destination and for a blocked slide", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(0, 0), color: "white", type: "rook" },
      { square: at(0, 3), color: "white", type: "pawn" },
    ],
  };
  const before = makeState(board);

  expectRejected(applyMove(before, { from: at(0, 0), to: at(0, 3) }), "illegal-move");
  expectRejected(applyMove(before, { from: at(0, 0), to: at(0, 5) }), "illegal-move");
});

test("castling is not generated, so a king's two-square move is rejected", () => {
  // Storing castling rights is not permission to castle: moves.ts generates
  // no castling move, so applyMove must refuse one.
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(7, 0), color: "white", type: "rook" },
    ],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  expectRejected(applyMove(before, { from: at(4, 0), to: at(6, 0) }), "illegal-move");
});

test("en passant is not generated, so a capture onto the target square is rejected", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(3, 4), color: "white", type: "pawn" },
      { square: at(4, 4), color: "black", type: "pawn" },
    ],
  };
  // Black has just played e7-e5; the skipped square is e6.
  const before = makeState(board, "white", NO_RIGHTS, at(4, 5));

  expectRejected(applyMove(before, { from: at(3, 4), to: at(4, 5) }), "illegal-move");
});

// --- capture --------------------------------------------------------------

test("a capture removes the captured piece and leaves the mover on its square", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(0, 0), color: "white", type: "rook" },
      { square: at(0, 4), color: "black", type: "pawn" },
      { square: at(5, 5), color: "black", type: "king" },
    ],
  };
  const before = makeState(board, "white", NO_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(0, 0), to: at(0, 4) }));

  assert.strictEqual(next.board.pieces.length, 2);
  assert.deepStrictEqual(pieceOn(next.board, at(0, 4)), {
    square: at(0, 4),
    color: "white",
    type: "rook",
  });
  assert.strictEqual(
    next.board.pieces.filter(p => p.type === "pawn").length,
    0
  );
  // The captured pawn is still on the board we were handed.
  assert.strictEqual(before.board.pieces.length, 3);
});

// --- enPassantTarget ------------------------------------------------------

test("a white double pawn push sets enPassantTarget to the skipped square", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(4, 1), color: "white", type: "pawn" }],
  };
  const before = makeState(board, "white", NO_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(4, 1), to: at(4, 3) }));

  assert.deepStrictEqual(next.enPassantTarget, at(4, 2));
});

test("a black double pawn push sets enPassantTarget to the skipped square", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(2, 6), color: "black", type: "pawn" }],
  };
  const before = makeState(board, "black", NO_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(2, 6), to: at(2, 4) }));

  assert.deepStrictEqual(next.enPassantTarget, at(2, 5));
});

test("a single pawn push sets enPassantTarget to null", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(4, 1), color: "white", type: "pawn" }],
  };
  const before = makeState(board, "white", NO_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(4, 1), to: at(4, 2) }));

  assert.strictEqual(next.enPassantTarget, null);
});

test("a non-pawn move clears a target left by the previous move", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 4), color: "black", type: "pawn" },
    ],
  };
  // Standing target from black's last move; a knight move must rewrite it.
  const before = makeState(board, "white", NO_RIGHTS, at(4, 5));

  const next = expectOk(applyMove(before, { from: at(1, 0), to: at(2, 2) }));

  assert.strictEqual(next.enPassantTarget, null);
});

// --- castling narrowing ---------------------------------------------------

test("a king move clears both of its own rights and neither of the opponent's", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(4, 0), to: at(4, 1) }));

  assert.deepStrictEqual(next.castling, {
    whiteKingside: false,
    whiteQueenside: false,
    blackKingside: true,
    blackQueenside: true,
  });
  assert.deepStrictEqual(before.castling, ALL_RIGHTS);
});

test("a black king move clears only black's rights", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(4, 7), color: "black", type: "king" }],
  };
  const before = makeState(board, "black", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(4, 7), to: at(4, 6) }));

  assert.deepStrictEqual(next.castling, {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: false,
    blackQueenside: false,
  });
});

test("a rook leaving file 0 clears that colour's queenside right only", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(0, 0), color: "white", type: "rook" }],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(0, 0), to: at(0, 4) }));

  assert.deepStrictEqual(next.castling, {
    whiteKingside: true,
    whiteQueenside: false,
    blackKingside: true,
    blackQueenside: true,
  });
});

test("a rook leaving the last file clears that colour's kingside right only", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(7, 0), color: "white", type: "rook" }],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(7, 0), to: at(7, 4) }));

  assert.deepStrictEqual(next.castling, {
    whiteKingside: false,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true,
  });
});

test("a rook moving from a non-corner square clears nothing", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(3, 3), color: "white", type: "rook" }],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(3, 3), to: at(3, 5) }));

  assert.deepStrictEqual(next.castling, ALL_RIGHTS);
});

test("corners come from board.size: a 5x5 black rook on the far corner clears blackKingside", () => {
  const board: Board = {
    size: 5,
    pieces: [{ square: at(4, 4), color: "black", type: "rook" }],
  };
  const before = makeState(board, "black", ALL_RIGHTS);

  const next = expectOk(applyMove(before, { from: at(4, 4), to: at(4, 2) }));

  assert.deepStrictEqual(next.castling, {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: false,
    blackQueenside: true,
  });
});

test("rights never come back: a move from a state with no rights keeps them false", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(0, 0), color: "white", type: "rook" },
    ],
  };
  const before = makeState(board, "white", NO_RIGHTS);

  const afterKing = expectOk(applyMove(before, { from: at(4, 0), to: at(4, 1) }));
  assert.deepStrictEqual(afterKing.castling, NO_RIGHTS);

  const afterRook = expectOk(applyMove(before, { from: at(0, 0), to: at(0, 4) }));
  assert.deepStrictEqual(afterRook.castling, NO_RIGHTS);
});

test("a right stays false once a second move is applied", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(0, 0), color: "white", type: "rook" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };
  const before = makeState(board, "white", ALL_RIGHTS);

  const one = expectOk(applyMove(before, { from: at(0, 0), to: at(0, 4) }));
  const two = expectOk(applyMove(one, { from: at(1, 7), to: at(2, 5) }));
  const three = expectOk(applyMove(two, { from: at(0, 4), to: at(0, 0) }));

  // Back on the corner it came from, and the right is still gone.
  assert.strictEqual(three.castling.whiteQueenside, false);
});

// --- PositionKey ----------------------------------------------------------

test("the key does not depend on the order of board.pieces", () => {
  const white: Piece = { square: at(1, 0), color: "white", type: "knight" };
  const black: Piece = { square: at(4, 7), color: "black", type: "king" };

  const oneOrder = makeState(
    { size: 8, pieces: [white, black] },
    "white",
    ALL_RIGHTS
  );
  const otherOrder = makeState(
    { size: 8, pieces: [black, white] },
    "white",
    ALL_RIGHTS
  );

  const move = { from: at(1, 0), to: at(2, 2) };

  assert.strictEqual(
    lastKey(expectOk(applyMove(oneOrder, move))),
    lastKey(expectOk(applyMove(otherOrder, move)))
  );
});

test("the key distinguishes positions that differ only in castling rights", () => {
  const pieces: Piece[] = [
    { square: at(1, 0), color: "white", type: "knight" },
    { square: at(4, 7), color: "black", type: "king" },
  ];
  const move = { from: at(1, 0), to: at(2, 2) };

  const withRight = makeState({ size: 8, pieces }, "white", ALL_RIGHTS);
  const withoutRight = makeState({ size: 8, pieces }, "white", {
    ...ALL_RIGHTS,
    blackKingside: false,
  });

  assert.notStrictEqual(
    lastKey(expectOk(applyMove(withRight, move))),
    lastKey(expectOk(applyMove(withoutRight, move)))
  );
});

test("the key distinguishes positions that differ only in en passant target", () => {
  // Both lines end with the same pawn on the same square, the same rook, the
  // same side to move and the same rights. Only the skipped square differs.
  const viaDoublePush = makeState(
    {
      size: 8,
      pieces: [
        { square: at(0, 1), color: "white", type: "pawn" },
        { square: at(7, 0), color: "white", type: "rook" },
      ],
    },
    "white",
    NO_RIGHTS
  );
  const viaSinglePush = makeState(
    {
      size: 8,
      pieces: [
        { square: at(0, 2), color: "white", type: "pawn" },
        { square: at(7, 0), color: "white", type: "rook" },
      ],
    },
    "white",
    NO_RIGHTS
  );

  const afterDouble = expectOk(
    applyMove(viaDoublePush, { from: at(0, 1), to: at(0, 3) })
  );
  const afterSingle = expectOk(
    applyMove(viaSinglePush, { from: at(0, 2), to: at(0, 3) })
  );

  assert.deepStrictEqual(afterDouble.enPassantTarget, at(0, 2));
  assert.strictEqual(afterSingle.enPassantTarget, null);
  assert.deepStrictEqual(
    afterDouble.board.pieces.map(p => p.square),
    afterSingle.board.pieces.map(p => p.square)
  );
  assert.strictEqual(afterDouble.sideToMove, afterSingle.sideToMove);
  assert.notStrictEqual(lastKey(afterDouble), lastKey(afterSingle));
});

test("a repeated position produces a repeated key", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };
  const start = makeState(board, "white", NO_RIGHTS);

  // Knights out and back: the position after white's first move recurs after
  // the fifth.
  const one = expectOk(applyMove(start, { from: at(1, 0), to: at(2, 2) }));
  const two = expectOk(applyMove(one, { from: at(1, 7), to: at(2, 5) }));
  const three = expectOk(applyMove(two, { from: at(2, 2), to: at(1, 0) }));
  const four = expectOk(applyMove(three, { from: at(2, 5), to: at(1, 7) }));
  const five = expectOk(applyMove(four, { from: at(1, 0), to: at(2, 2) }));

  assert.strictEqual(five.history.length, 5);
  assert.strictEqual(lastKey(five), lastKey(one));
  assert.strictEqual(
    five.history.filter(key => key === lastKey(one)).length,
    2
  );
});

test("a key is appended for every applied move and for no rejected one", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const start = makeState(board, "white", NO_RIGHTS);

  const rejected = applyMove(start, { from: at(1, 0), to: at(1, 1) });
  expectRejected(rejected, "illegal-move");
  assert.strictEqual(start.history.length, 0);

  const accepted = expectOk(applyMove(start, { from: at(1, 0), to: at(2, 2) }));
  assert.strictEqual(accepted.history.length, 1);
});

// --- sideToMove -----------------------------------------------------------

const destinationKeys = (moves: Move[]): string[] =>
  moves.map(move => `${move.to.file},${move.to.rank}`).sort();

test("sideToMove reads the field, for both colours", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };

  assert.strictEqual(sideToMove(makeState(board, "white")), "white");
  assert.strictEqual(sideToMove(makeState(board, "black")), "black");
});

test("sideToMove reads the field, not the length of history", () => {
  // A state handed in mid-game: three keys in history, and white still to
  // move. Section 4 says the field is the truth, with no derivation from
  // history length and no turn counter to divide.
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, ["a", "b", "c"]);

  assert.strictEqual(sideToMove(state), "white");
});

test("sideToMove follows applyMove flipping the field", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };
  const start = makeState(board, "white", NO_RIGHTS);

  const one = expectOk(applyMove(start, { from: at(1, 0), to: at(2, 2) }));
  const two = expectOk(applyMove(one, { from: at(1, 7), to: at(2, 5) }));

  assert.strictEqual(sideToMove(start), "white");
  assert.strictEqual(sideToMove(one), "black");
  assert.strictEqual(sideToMove(two), "white");
});

// --- legalMovesFrom -------------------------------------------------------

test("legalMovesFrom returns the generated moves for the side to move", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };

  const moves = legalMovesFrom(makeState(board, "white"), at(1, 0));

  // The same list moves.ts produced. The only thing this layer adds on top of
  // movesFrom is the turn check.
  assert.ok(moves.length > 0);
  assert.deepStrictEqual(
    destinationKeys(moves),
    destinationKeys(movesFrom(at(1, 0), board))
  );
  for (const move of moves) {
    assert.deepStrictEqual(move.from, at(1, 0));
  }
});

test("legalMovesFrom returns [] for that same piece when it is not its turn", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };

  // The board is identical in both calls. Only the turn differs, and the turn
  // is not on the Board -- which is why a renderer cannot call movesFrom.
  assert.ok(legalMovesFrom(makeState(board, "white"), at(1, 0)).length > 0);
  assert.deepStrictEqual(
    legalMovesFrom(makeState(board, "black"), at(1, 0)),
    []
  );
});

test("legalMovesFrom filters in the other direction too", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };

  assert.ok(legalMovesFrom(makeState(board, "black"), at(4, 7)).length > 0);
  assert.deepStrictEqual(
    legalMovesFrom(makeState(board, "white"), at(4, 7)),
    []
  );
});

test("legalMovesFrom returns [] for an empty square, whoever is to move", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };

  assert.deepStrictEqual(
    legalMovesFrom(makeState(board, "white"), at(5, 5)),
    []
  );
  assert.deepStrictEqual(
    legalMovesFrom(makeState(board, "black"), at(5, 5)),
    []
  );
});

test("legalMovesFrom returns [] for a square off this board", () => {
  const board: Board = {
    size: 5,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };

  // Dimensions come from board.size: (6,6) is off a 5x5 board, and no piece
  // stands there.
  assert.deepStrictEqual(
    legalMovesFrom(makeState(board, "white"), at(6, 6)),
    []
  );
});

test("legalMovesFrom works on a board that is not eight wide", () => {
  const board: Board = {
    size: 5,
    pieces: [
      { square: at(2, 2), color: "white", type: "king" },
      // A rook, not a king: this test is about board-size independence, and
      // on a 5x5 every square is adjacent to some square in the white king's
      // ring, so a black king would remove one of the eight. The rook attacks
      // file 0 and rank 4 only, which the ring (files 1-3, ranks 1-3) never
      // touches. King adjacency is covered on its own further down.
      { square: at(0, 4), color: "black", type: "rook" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  const moves = legalMovesFrom(state, at(2, 2));

  assert.strictEqual(moves.length, 8);
  for (const move of moves) {
    assert.ok(move.to.file >= 0 && move.to.file < board.size);
    assert.ok(move.to.rank >= 0 && move.to.rank < board.size);
  }
  assert.deepStrictEqual(legalMovesFrom(state, at(0, 4)), []);
});

test("legalMovesFrom mutates nothing", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, ["seeded-key"]);
  const snapshot = structuredClone(state);

  legalMovesFrom(state, at(1, 0));
  legalMovesFrom(state, at(4, 7));
  legalMovesFrom(state, at(5, 5));

  assert.deepStrictEqual(state, snapshot);
});

test("every move legalMovesFrom offers is accepted by applyMove", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(2, 2), color: "black", type: "pawn" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);
  const moves = legalMovesFrom(state, at(1, 0));

  assert.ok(moves.length > 0);
  for (const move of moves) {
    expectOk(applyMove(state, move));
  }
});

test("a move offered when it is not your turn is rejected by applyMove", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "king" },
    ],
  };
  const whiteToMove = makeState(board, "white", NO_RIGHTS);
  const blackToMove = makeState(board, "black", NO_RIGHTS);

  const move = legalMovesFrom(whiteToMove, at(1, 0))[0];
  if (move === undefined) {
    throw new Error("expected at least one knight move");
  }

  assert.deepStrictEqual(legalMovesFrom(blackToMove, at(1, 0)), []);
  expectRejected(applyMove(blackToMove, move), "wrong-side");
});

// --- isRepetitionDraw -----------------------------------------------------

test("isRepetitionDraw is false on an empty history", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };

  assert.strictEqual(isRepetitionDraw(makeState(board)), false);
});

test("isRepetitionDraw is false at two occurrences of the last key", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, [
    "p",
    "q",
    "p",
    "r",
    "p",
    "q",
  ]);

  // 'q' is the last key and appears twice. 'p' appears three times but is not
  // the current position, so it does not end the game.
  assert.strictEqual(isRepetitionDraw(state), false);
});

test("isRepetitionDraw is true at three occurrences of the last key", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, [
    "q",
    "p",
    "q",
    "r",
    "q",
  ]);

  assert.strictEqual(isRepetitionDraw(state), true);
});

test("isRepetitionDraw stays true past three occurrences", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, [
    "q",
    "q",
    "q",
    "q",
  ]);

  assert.strictEqual(isRepetitionDraw(state), true);
});

test("isRepetitionDraw is false after a single applied move", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const start = makeState(board, "white", NO_RIGHTS);

  const one = expectOk(applyMove(start, { from: at(1, 0), to: at(2, 2) }));

  assert.strictEqual(one.history.length, 1);
  assert.strictEqual(isRepetitionDraw(one), false);
});

test("isRepetitionDraw fires on the third occurrence of a shuffled position", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 7), color: "black", type: "knight" },
    ],
  };

  // Knights out and back. The position after white's first move recurs after
  // the fifth move and again after the ninth.
  const shuffle: Move[] = [
    { from: at(1, 0), to: at(2, 2) },
    { from: at(1, 7), to: at(2, 5) },
    { from: at(2, 2), to: at(1, 0) },
    { from: at(2, 5), to: at(1, 7) },
  ];

  let state = makeState(board, "white", NO_RIGHTS);
  const drawAfterEachMove: boolean[] = [];

  for (let i = 0; i < 9; i++) {
    const move = shuffle[i % shuffle.length];
    if (move === undefined) {
      throw new Error("shuffle index out of range");
    }
    state = expectOk(applyMove(state, move));
    drawAfterEachMove.push(isRepetitionDraw(state));
  }

  assert.strictEqual(state.history.length, 9);
  assert.strictEqual(
    state.history.filter(key => key === lastKey(state)).length,
    3
  );
  assert.deepStrictEqual(drawAfterEachMove, [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
});

test("isRepetitionDraw mutates nothing", () => {
  const board: Board = {
    size: 8,
    pieces: [{ square: at(1, 0), color: "white", type: "knight" }],
  };
  const state = makeState(board, "white", ALL_RIGHTS, null, ["q", "q", "q"]);
  const snapshot = structuredClone(state);

  assert.strictEqual(isRepetitionDraw(state), true);
  assert.deepStrictEqual(state, snapshot);
});

// --- legality: isInCheck --------------------------------------------------
// §12. moves.ts is still pseudo-legal; everything below is this layer asking
// it more often, never reimplementing it.

// Destinations as sorted "file,rank" strings, so a test can compare sets
// without depending on the order moves come back in.
const destinations = (moves: Move[]): string[] =>
  moves.map(move => `${move.to.file},${move.to.rank}`).sort();

function onlyMove(moves: Move[]): Move {
  assert.strictEqual(moves.length, 1, `expected exactly one move, got ${moves.length}`);
  const move = moves[0];
  if (move === undefined) {
    throw new Error("expected one move, got none");
  }
  return move;
}

function expectStatus(state: GameState, expected: GameStatus): void {
  assert.strictEqual(gameStatus(state), expected);
}

test("isInCheck is true when the side to move has a king under attack", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };

  assert.strictEqual(isInCheck(makeState(board, "white", NO_RIGHTS)), true);
});

test("isInCheck is false in a quiet position", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(0, 5), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };

  assert.strictEqual(isInCheck(makeState(board, "white", NO_RIGHTS)), false);
});

test("isInCheck asks about the side to move, not the other king", () => {
  // Black's king is the one being attacked, on file 0.
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(0, 0), color: "white", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };

  assert.strictEqual(isInCheck(makeState(board, "white", NO_RIGHTS)), false);
  assert.strictEqual(isInCheck(makeState(board, "black", NO_RIGHTS)), true);
});

test("isInCheck is false when the side to move has no king at all", () => {
  // The ordinary case on the tier-1 teaching boards, not an edge case.
  const board: Board = {
    size: 5,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 4), color: "black", type: "rook" },
    ],
  };

  assert.strictEqual(isInCheck(makeState(board, "white", NO_RIGHTS)), false);
});

test("a pawn's forward push is not an attack, and needs no special case", () => {
  // A black pawn on (4,1) pushes to (4,0) only if (4,0) is empty. The white
  // king stands there, so no push is generated onto it and the king is not in
  // check. The pawn does attack (3,0) and (5,0), which the next assertion
  // shows by putting the king on one of them.
  const pushBoard: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 1), color: "black", type: "pawn" },
    ],
  };
  assert.strictEqual(isInCheck(makeState(pushBoard, "white", NO_RIGHTS)), false);

  const captureBoard: Board = {
    size: 8,
    pieces: [
      { square: at(3, 0), color: "white", type: "king" },
      { square: at(4, 1), color: "black", type: "pawn" },
    ],
  };
  assert.strictEqual(isInCheck(makeState(captureBoard, "white", NO_RIGHTS)), true);
});

// --- legality: pins -------------------------------------------------------

test("a pinned knight has pseudo-legal moves but no legal ones", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 1), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  // moves.ts still offers them: it knows nothing about check.
  assert.ok(movesFrom(at(4, 1), board).length > 0);

  // An empty result no longer means "not your piece".
  assert.deepStrictEqual(legalMovesFrom(state, at(4, 1)), []);
});

test("a pinned rook may only move along the pin line", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 3), color: "white", type: "rook" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  const pseudo = movesFrom(at(4, 3), board);
  const legal = legalMovesFrom(state, at(4, 3));

  assert.ok(pseudo.length > legal.length);
  assert.deepStrictEqual(
    destinations(legal),
    destinations([
      { from: at(4, 3), to: at(4, 1) },
      { from: at(4, 3), to: at(4, 2) },
      { from: at(4, 3), to: at(4, 4) },
      { from: at(4, 3), to: at(4, 5) },
      { from: at(4, 3), to: at(4, 6) },
      // Capturing the pinning rook stays on the line, so it is legal.
      { from: at(4, 3), to: at(4, 7) },
    ])
  );
});

// --- legality: kings ------------------------------------------------------

test("a king may not move into an attacked square", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(3, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  // Not in check where it stands; file 3 is what it must avoid.
  assert.strictEqual(isInCheck(state), false);
  assert.ok(
    destinations(movesFrom(at(4, 0), board)).includes("3,0"),
    "moves.ts should still offer the attacked square"
  );

  assert.deepStrictEqual(destinations(legalMovesFrom(state, at(4, 0))), [
    "4,1",
    "5,0",
    "5,1",
  ]);
});

test("a king may not step next to the enemy king, on a 5x5 board", () => {
  const board: Board = {
    size: 5,
    pieces: [
      { square: at(2, 2), color: "white", type: "king" },
      { square: at(0, 4), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  assert.strictEqual(movesFrom(at(2, 2), board).length, 8);

  const legal = legalMovesFrom(state, at(2, 2));

  assert.strictEqual(legal.length, 7);
  assert.ok(!destinations(legal).includes("1,3"));
});

test("a king may not capture a defended piece", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      // Checking rook, defended along the file by the second one.
      { square: at(4, 1), color: "black", type: "rook" },
      { square: at(4, 5), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  assert.strictEqual(isInCheck(state), true);

  const legal = legalMovesFrom(state, at(4, 0));

  assert.ok(destinations(movesFrom(at(4, 0), board)).includes("4,1"));
  assert.ok(!destinations(legal).includes("4,1"));
  // The two squares off the rooks' file and rank.
  assert.deepStrictEqual(destinations(legal), ["3,0", "5,0"]);
});

test("in check, only the moves that address the check are legal", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(3, 3), color: "white", type: "rook" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  assert.ok(movesFrom(at(3, 3), board).length > 1);

  // The one interposition on the checking file.
  const blocking = onlyMove(legalMovesFrom(state, at(3, 3)));

  assert.deepStrictEqual(blocking.to, at(4, 3));

  const after = expectOk(applyMove(state, blocking));

  assert.strictEqual(sideToMove(after), "black");
  assert.strictEqual(isInCheck({ ...after, sideToMove: "white" }), false);
});

// --- legality: applyMove --------------------------------------------------

test("applyMove rejects a self-check move as 'illegal-move'", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 1), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);
  const pseudo = movesFrom(at(4, 1), board);

  assert.ok(pseudo.length > 0);

  // Every move the pinned knight has hangs its own king, and every one of
  // them comes back as 'illegal-move'. There is deliberately no separate
  // rejection reason for self-check.
  for (const move of pseudo) {
    expectRejected(applyMove(state, move), "illegal-move");
  }
});

test("applyMove rejects a king walking into an attacked square", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(3, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  expectRejected(
    applyMove(state, { from: at(4, 0), to: at(3, 0) }),
    "illegal-move"
  );

  // The state is untouched by the rejection, and a legal escape still works.
  assert.strictEqual(state.history.length, 0);
  expectOk(applyMove(state, { from: at(4, 0), to: at(5, 0) }));
});

test("a rejected self-check move leaves the state and its board untouched", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 1), color: "white", type: "knight" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);
  const snapshot = structuredClone(state);

  expectRejected(applyMove(state, { from: at(4, 1), to: at(5, 3) }), "illegal-move");

  assert.deepStrictEqual(state, snapshot);
});

test("every move legalMovesFrom offers in a pinned position is accepted", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 3), color: "white", type: "rook" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);
  const legal = legalMovesFrom(state, at(4, 3));

  assert.ok(legal.length > 0);

  for (const move of legal) {
    expectOk(applyMove(state, move));
  }
});

// --- gameStatus -----------------------------------------------------------

// Back-rank mate. Black king on (6,7) is boxed in by its own pawns and checked
// along rank 7 by the white rook on (4,7). Moving to (5,7) or (7,7) stays on
// the rook's rank, which is why the filter has to test the resulting position
// rather than the current one.
const MATE_BOARD: Board = {
  size: 8,
  pieces: [
    { square: at(4, 0), color: "white", type: "king" },
    { square: at(4, 7), color: "white", type: "rook" },
    { square: at(6, 7), color: "black", type: "king" },
    { square: at(5, 6), color: "black", type: "pawn" },
    { square: at(6, 6), color: "black", type: "pawn" },
    { square: at(7, 6), color: "black", type: "pawn" },
  ],
};

// Black king on (7,7) with the white queen on (5,6) covering every square it
// could move to, and none of the square it stands on.
const STALEMATE_BOARD: Board = {
  size: 8,
  pieces: [
    { square: at(0, 0), color: "white", type: "king" },
    { square: at(5, 6), color: "white", type: "queen" },
    { square: at(7, 7), color: "black", type: "king" },
  ],
};

test("gameStatus returns 'checkmate' for a real mate", () => {
  const state = makeState(MATE_BOARD, "black", NO_RIGHTS);

  assert.strictEqual(isInCheck(state), true);

  for (const piece of MATE_BOARD.pieces) {
    if (piece.color === "black") {
      assert.deepStrictEqual(legalMovesFrom(state, piece.square), []);
    }
  }

  expectStatus(state, "checkmate");
});

test("gameStatus returns 'stalemate' for a real stalemate", () => {
  const state = makeState(STALEMATE_BOARD, "black", NO_RIGHTS);

  assert.strictEqual(isInCheck(state), false);
  assert.deepStrictEqual(legalMovesFrom(state, at(7, 7)), []);

  expectStatus(state, "stalemate");

  // The side that can still move is not stalemated.
  expectStatus(makeState(STALEMATE_BOARD, "white", NO_RIGHTS), "playing");
});

test("gameStatus returns 'check' when the king is attacked but can escape", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(4, 7), color: "black", type: "rook" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS);

  assert.ok(legalMovesFrom(state, at(4, 0)).length > 0);
  expectStatus(state, "check");
});

test("gameStatus returns 'playing' for a quiet position", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };

  expectStatus(makeState(board, "white", NO_RIGHTS), "playing");
});

test("gameStatus returns 'repetition-draw' when the last key has occurred three times", () => {
  const board: Board = {
    size: 8,
    pieces: [
      { square: at(4, 0), color: "white", type: "king" },
      { square: at(0, 7), color: "black", type: "king" },
    ],
  };
  const state = makeState(board, "white", NO_RIGHTS, null, ["k1", "k2", "k1", "k2", "k1"]);

  assert.strictEqual(isRepetitionDraw(state), true);
  expectStatus(state, "repetition-draw");
});

test("mate outranks repetition: a mated king is not a draw", () => {
  const state = makeState(MATE_BOARD, "black", NO_RIGHTS, null, ["k1", "k1", "k1"]);

  assert.strictEqual(isRepetitionDraw(state), true);
  expectStatus(state, "checkmate");
});

test("stalemate outranks repetition too", () => {
  const state = makeState(STALEMATE_BOARD, "black", NO_RIGHTS, null, ["k1", "k1", "k1"]);

  assert.strictEqual(isRepetitionDraw(state), true);
  expectStatus(state, "stalemate");
});

test("gameStatus is 'playing' on a kingless teaching board that has moves", () => {
  const board: Board = {
    size: 5,
    pieces: [
      { square: at(1, 0), color: "white", type: "knight" },
      { square: at(1, 4), color: "black", type: "rook" },
    ],
  };

  expectStatus(makeState(board, "white", NO_RIGHTS), "playing");
});

test("isInCheck, legalMovesFrom and gameStatus mutate nothing", () => {
  const state = makeState(MATE_BOARD, "black", NO_RIGHTS, null, ["seeded-key"]);
  const snapshot = structuredClone(state);

  isInCheck(state);
  legalMovesFrom(state, at(6, 7));
  legalMovesFrom(state, at(6, 6));
  gameStatus(state);

  assert.deepStrictEqual(state, snapshot);
});
