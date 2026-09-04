// game.ts — the game layer, per contracts/game-state.md.
//
// board-state owns squares. This owns everything squares cannot say: whose
// turn it is, what rights survive, what the last move made available, and
// what has already happened.
//
// Every question about where a piece may move is answered by calling into
// moves.ts. No chess rule is computed here.

import { movesFrom } from "./moves.js";
import type { Board, Color, Move, Piece, PieceType, Square } from "./moves.js";

// §5. Four booleans. Not a set, not flags on the pieces: this state has to
// outlive the pieces it describes. Rights only ever go true -> false.
export type CastlingRights = {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
};

// §9. A string identifying a position: placement, side to move, castling
// rights, en passant target. Produced in exactly one place — see
// `positionKey`, which is deliberately not exported.
export type PositionKey = string;

// §3. The board goes in whole. No shadow copy of where the pieces are.
export type GameState = {
  board: Board;
  sideToMove: Color;
  castling: CastlingRights;
  enPassantTarget: Square | null;
  history: PositionKey[];
};

// §10. Rejection is a value, not an exception: it crosses a layer boundary on
// its way to a renderer handling a six-year-old's misplaced tap.
export type MoveRejection =
  | "empty-square"
  | "wrong-side"
  | "illegal-move"
  | "off-board";

export type MoveResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: MoveRejection };

// --- board reads (lookups over state.board, never a second copy of it) ----

const sameSquare = (a: Square, b: Square): boolean =>
  a.file === b.file && a.rank === b.rank;

const pieceOn = (board: Board, square: Square): Piece | undefined =>
  board.pieces.find(piece => sameSquare(piece.square, square));

// board.size is the only source of dimensions.
const isOnBoard = (board: Board, square: Square): boolean =>
  Number.isInteger(square.file) &&
  Number.isInteger(square.rank) &&
  square.file >= 0 && square.file < board.size &&
  square.rank >= 0 && square.rank < board.size;

// --- PositionKey ----------------------------------------------------------

// Everything a key is built from except history. applyMove assembles one of
// these for the position it just produced, and keys that.
type Position = {
  board: Board;
  sideToMove: Color;
  castling: CastlingRights;
  enPassantTarget: Square | null;
};

const PIECE_LETTER: Record<PieceType, string> = {
  king: "k",
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
  pawn: "p",
};

// A grid scan, so the key does not depend on the order of board.pieces. Two
// boards holding the same pieces in different array order are the same
// position and must key identically.
//
// Empty squares are '.' rather than FEN's run-length digits: on a board wider
// than nine squares, a run of twelve and a run of one then two would be the
// same string, and two different positions sharing a key is the exact bug
// this field exists to prevent.
function placementField(board: Board): string {
  const rows: string[] = [];

  for (let rank = board.size - 1; rank >= 0; rank--) {
    let row = "";

    for (let file = 0; file < board.size; file++) {
      const piece = pieceOn(board, { file, rank });

      if (piece === undefined) {
        row += ".";
      } else {
        const letter = PIECE_LETTER[piece.type];
        row += piece.color === "white" ? letter.toUpperCase() : letter;
      }
    }

    rows.push(row);
  }

  return rows.join("/");
}

function castlingField(rights: CastlingRights): string {
  const field =
    (rights.whiteKingside ? "K" : "") +
    (rights.whiteQueenside ? "Q" : "") +
    (rights.blackKingside ? "k" : "") +
    (rights.blackQueenside ? "q" : "");

  return field === "" ? "-" : field;
}

const enPassantField = (target: Square | null): string =>
  target === null ? "-" : target.file + "," + target.rank;

// THE one place a PositionKey is made. Not exported: §11 is explicit that
// nothing recomputes a key to compare against a stored one, because two ways
// to get the same number is one way too many.
function positionKey(position: Position): PositionKey {
  return [
    placementField(position.board),
    position.sideToMove,
    castlingField(position.castling),
    enPassantField(position.enPassantTarget),
  ].join(" ");
}

// --- castling narrowing ---------------------------------------------------

type RightName = keyof CastlingRights;

const homeRank = (color: Color, size: number): number =>
  color === "white" ? 0 : size - 1;

// The moved-piece cases only. A rook *captured* on its home square must also
// clear a right (§5), but detecting that needs home squares GameState does
// not record; that case is explicitly not implementable and is left alone.
function rightsLostBy(mover: Piece, from: Square, size: number): RightName[] {
  const kingside: RightName =
    mover.color === "white" ? "whiteKingside" : "blackKingside";
  const queenside: RightName =
    mover.color === "white" ? "whiteQueenside" : "blackQueenside";

  if (mover.type === "king") {
    return [kingside, queenside];
  }

  // A rook only ever carried a right from its own colour's home rank. Corners
  // come from board.size, not from a literal 8.
  if (mover.type === "rook" && from.rank === homeRank(mover.color, size)) {
    const lost: RightName[] = [];

    if (from.file === 0) lost.push(queenside);
    if (from.file === size - 1) lost.push(kingside);

    return lost;
  }

  return [];
}

// AND-only, so a right can never come back. There is no path from false to
// true anywhere in this file.
function narrowCastling(
  rights: CastlingRights,
  lost: readonly RightName[]
): CastlingRights {
  return {
    whiteKingside: rights.whiteKingside && !lost.includes("whiteKingside"),
    whiteQueenside: rights.whiteQueenside && !lost.includes("whiteQueenside"),
    blackKingside: rights.blackKingside && !lost.includes("blackKingside"),
    blackQueenside: rights.blackQueenside && !lost.includes("blackQueenside"),
  };
}

// --- applyMove ------------------------------------------------------------

const copyPiece = (piece: Piece, square: Square): Piece => ({
  square: { file: square.file, rank: square.rank },
  color: piece.color,
  type: piece.type,
});

/**
 * The only operation that advances a game. Validates in the order §10 fixes,
 * returns a rejection value rather than throwing, and never returns the input
 * state unchanged.
 *
 * Pseudo-legal only: moves.ts does not detect check, so this will accept a
 * move that leaves a king attacked. Nothing here pretends otherwise.
 */
export function applyMove(state: GameState, move: Move): MoveResult {
  const board = state.board;

  // 1. Both squares are on the board.
  if (!isOnBoard(board, move.from) || !isOnBoard(board, move.to)) {
    return { ok: false, reason: "off-board" };
  }

  // 2. move.from holds a piece.
  const mover = pieceOn(board, move.from);

  if (mover === undefined) {
    return { ok: false, reason: "empty-square" };
  }

  // 3. That piece's colour is the side to move.
  if (mover.color !== state.sideToMove) {
    return { ok: false, reason: "wrong-side" };
  }

  // 4. The move appears in what moves.ts generated. This layer does not
  //    decide what is legal; it asks.
  const generated = movesFrom(move.from, board);
  const isGenerated = generated.some(
    candidate =>
      sameSquare(candidate.from, move.from) && sameSquare(candidate.to, move.to)
  );

  if (!isGenerated) {
    return { ok: false, reason: "illegal-move" };
  }

  // New board. Every piece is a fresh object, so nothing in the returned
  // state shares an identity with anything in the input state.
  const nextBoard: Board = {
    size: board.size,
    pieces: board.pieces
      // A captured piece standing on move.to leaves the board.
      .filter(piece => !sameSquare(piece.square, move.to))
      .map(piece =>
        sameSquare(piece.square, move.from)
          ? copyPiece(piece, move.to)
          : copyPiece(piece, piece.square)
      ),
  };

  // §6. Rewritten on every move, not only on pawn moves, so it is never
  // stale. The square skipped over, not "was the last move a double push".
  const isDoublePush =
    mover.type === "pawn" && Math.abs(move.to.rank - move.from.rank) === 2;

  const nextEnPassantTarget: Square | null = isDoublePush
    ? { file: move.from.file, rank: (move.from.rank + move.to.rank) / 2 }
    : null;

  const advanced: Position = {
    board: nextBoard,
    sideToMove: state.sideToMove === "white" ? "black" : "white",
    castling: narrowCastling(
      state.castling,
      rightsLostBy(mover, move.from, board.size)
    ),
    enPassantTarget: nextEnPassantTarget,
  };

  return {
    ok: true,
    state: {
      ...advanced,
      history: [...state.history, positionKey(advanced)],
    },
  };
}

// --- consumer surface -----------------------------------------------------
// §11. board-render and anything else above this layer use exactly these
// (plus applyMove). Nothing above reaches into GameState to compute a chess
// answer by hand.

/**
 * Whose turn it is. §4: one field, read it. There is no turn counter to
 * divide, and no derivation from history length — a state can be handed to
 * this layer mid-game with a seeded or empty history and the field is still
 * the truth.
 */
export function sideToMove(state: GameState): Color {
  return state.sideToMove;
}

/**
 * The turn filter, and the reason a renderer must never call `movesFrom`
 * itself: `movesFrom` answers what a piece can do, not whether it may, and
 * whose turn it is lives here rather than on the Board.
 *
 * Returns `[]` for an empty square and for a piece belonging to the side not
 * to move. Otherwise the generated list is returned as it came back. No move
 * generation happens here — the only thing added on top of moves.ts is the
 * turn check.
 *
 * Pseudo-legal, like everything downstream of moves.ts: "legal" here means
 * "generated, and it is your turn". Check is not detected anywhere in this
 * system, so a move that hangs a king is still returned.
 */
export function legalMovesFrom(state: GameState, from: Square): Move[] {
  const mover = pieceOn(state.board, from);

  if (mover === undefined) {
    return [];
  }

  if (mover.color !== state.sideToMove) {
    return [];
  }

  return movesFrom(from, state.board);
}

/**
 * Threefold repetition — the only draw this layer can see.
 *
 * It counts occurrences of `history[history.length - 1]`, the key applyMove
 * appended for the current position, and never recomputes a key from `state`.
 * §11: two ways to get the same number is one way too many, and a recomputed
 * key that disagreed with a stored one would produce a wrong draw with no
 * trail back to why. `positionKey` is the one producer and stays private.
 */
export function isRepetitionDraw(state: GameState): boolean {
  const current = state.history[state.history.length - 1];

  // Empty history: nothing has been played, so nothing has repeated.
  if (current === undefined) {
    return false;
  }

  let count = 0;

  for (const key of state.history) {
    if (key === current) {
      count++;
    }
  }

  return count >= 3;
}
