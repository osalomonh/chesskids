import { test } from "node:test";
import assert from "node:assert";
import { applyMove } from "./game.js";
import type {
  CastlingRights,
  GameState,
  MoveRejection,
  MoveResult,
  PositionKey,
} from "./game.js";
import type { Board, Color, Piece, Square } from "./moves.js";

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
