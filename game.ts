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

// THE board transition: move the piece, remove anything it captured.
//
// §10 is binding that this is factored out. applyMove's success path and the
// legality filter both call it, and the filter must never reach for applyMove
// instead - applyMove calls the filter, so that would be unbounded recursion
// on the first tap. One transition, two callers, no cycle.
//
// Every piece is a fresh object, so nothing in the result shares an identity
// with anything in the input board, and the input board is never mutated.
function boardAfter(board: Board, move: Move): Board {
  return {
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
}

// --- attack detection -----------------------------------------------------

/**
 * Is the king of `color` attacked on this board?
 *
 * §12: generate every enemy piece's moves and see whether any lands on the
 * king's square. There is no attack table and no per-piece attack function -
 * the move generator already knows what every piece reaches, and a second
 * implementation of that knowledge is a second thing to keep correct.
 *
 * No pawn special case, deliberately. A pawn's forward push looks like a move
 * that is not an attack, but `pawnMoves` only pushes onto an *empty* square,
 * and the square under test holds a king. A push can never be generated onto
 * it, so only the diagonal captures survive. The special case would be the bug.
 *
 * No king of that colour means no check: the tier-1 teaching boards have no
 * kings, and that is the ordinary case rather than an edge to guard against.
 */
function isKingAttacked(board: Board, color: Color): boolean {
  const king = board.pieces.find(
    piece => piece.type === "king" && piece.color === color
  );

  if (king === undefined) {
    return false;
  }

  return board.pieces.some(
    piece =>
      piece.color !== color &&
      movesFrom(piece.square, board).some(move =>
        sameSquare(move.to, king.square)
      )
  );
}

/**
 * The only operation that advances a game. Validates in the order §10 fixes,
 * returns a rejection value rather than throwing, and never returns the input
 * state unchanged.
 *
 * §12: legal means moves.ts generated it, the piece belongs to the side to
 * move, and playing it does not leave the mover's own king attacked. Step 4
 * asks `legalMovesFrom` all three questions at once, so there is one source of
 * legality. A self-check is rejected as 'illegal-move' - §10 is explicit that
 * there is deliberately no separate reason for it, because to a renderer
 * handling a six-year-old's tap it is the same event.
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

  // 4. The move appears in legalMovesFrom: generated by moves.ts, the right
  //    colour, and not a move that leaves the mover's own king attacked. This
  //    layer still generates nothing; it asks.
  const legal = legalMovesFrom(state, move.from);
  const isLegal = legal.some(
    candidate =>
      sameSquare(candidate.from, move.from) && sameSquare(candidate.to, move.to)
  );

  if (!isLegal) {
    return { ok: false, reason: "illegal-move" };
  }

  // The same transition the legality filter applied to a copy a moment ago.
  const nextBoard: Board = boardAfter(board, move);

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
 * to move. On top of that turn filter it drops every generated move that would
 * leave the mover's own king attacked (§12): apply the move to a copy of the
 * board with `boardAfter`, ask `isKingAttacked` about the result, discard the
 * move if the answer is yes.
 *
 * An empty result therefore no longer means "not your piece". A pinned piece
 * is yours, on your turn, with pseudo-legal moves, and correctly offers none.
 *
 * No move generation happens here, and nothing is cached: a cached legal-move
 * set would be a second source of truth about the position.
 */
export function legalMovesFrom(state: GameState, from: Square): Move[] {
  const mover = pieceOn(state.board, from);

  if (mover === undefined) {
    return [];
  }

  if (mover.color !== state.sideToMove) {
    return [];
  }

  return movesFrom(from, state.board).filter(
    candidate => !isKingAttacked(boardAfter(state.board, candidate), mover.color)
  );
}

/**
 * §11. Is the king of `state.sideToMove` attacked right now - not the other
 * side's king. Asking about the opponent is a different question, and flipping
 * a field to fake it is not how to ask it.
 *
 * `false` when that side has no king on the board, which is the normal case on
 * the small teaching boards.
 */
export function isInCheck(state: GameState): boolean {
  return isKingAttacked(state.board, state.sideToMove);
}

// §11. The one value a screen actually needs.
export type GameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "repetition-draw";

// "No legal moves" means every piece of the side to move returns [] from
// legalMovesFrom. Defined that way on purpose: one source of legality, asked
// the same way by everything.
function hasNoLegalMoves(state: GameState): boolean {
  return !state.board.pieces.some(
    piece =>
      piece.color === state.sideToMove &&
      legalMovesFrom(state, piece.square).length > 0
  );
}

/**
 * §11, first match wins, in this order:
 *
 *   1. no legal moves and in check -> checkmate
 *   2. no legal moves and not      -> stalemate
 *   3. repetition                  -> repetition-draw
 *   4. in check                    -> check
 *   5. otherwise                   -> playing
 *
 * Mate outranks repetition because mate ends the game where it stands. A
 * status function that called a mated king a draw would be telling the child
 * something false.
 */
export function gameStatus(state: GameState): GameStatus {
  const inCheck = isInCheck(state);

  if (hasNoLegalMoves(state)) {
    return inCheck ? "checkmate" : "stalemate";
  }

  if (isRepetitionDraw(state)) {
    return "repetition-draw";
  }

  return inCheck ? "check" : "playing";
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
