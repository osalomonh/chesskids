// standard-game.ts — the full 8x8 path, over chess.js.
//
// A thin, pure wrapper. chess.js owns every chess rule here: castling, en
// passant, promotion, check, checkmate, stalemate, repetition, the fifty-move
// rule and insufficient material. This file's only job is translation, so the
// renderer and the bots speak the vocabulary of `moves.ts` /
// `contracts/board-state.md` and never touch the chess.js API. Nothing from
// chess.js — the `Chess` class, its 'w'/'b' colours, its 'p'/'n' symbols, its
// `Move` class — leaves this file through an exported type or value.
//
// `game.ts` remains the variable-board path used by the lessons (5x5 and
// friends) and is unaffected by any of this.

import { Chess } from "chess.js";
import type {
  Color as ChessColor,
  PieceSymbol,
  Square as ChessSquare,
} from "chess.js";
import type {
  Board,
  Color,
  Move,
  Piece,
  PieceType,
  Square,
} from "./moves.js";

// --- types ----------------------------------------------------------------

export type PromotionPiece = "queen" | "rook" | "bishop" | "knight";

/**
 * A `Move` from `moves.ts` plus what a full game needs. `promotion` is present
 * only on promotion moves; `captures` is present only when the move takes a
 * piece (for en passant it is "pawn" even though `to` is empty).
 */
export type StandardMove = Move & {
  promotion?: PromotionPiece;
  captures?: PieceType;
};

export type StandardGame = {
  /** Always from white's perspective: {file: 0, rank: 0} is a1. */
  readonly board: Board;
  readonly sideToMove: Color;
  /** The full position, with clocks. Everything but repetition comes from it. */
  readonly fen: string;
  /** Every move applied since the standard start, long algebraic: "e2e4", "e7e8q". */
  readonly history: readonly string[];
};

export type MoveRejection =
  | "empty-square"
  | "wrong-side"
  | "illegal-move"
  | "off-board"
  | "game-over";

export type MoveResult =
  | { ok: true; game: StandardGame }
  | { ok: false; reason: MoveRejection };

export type StandardGameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "repetition-draw"
  | "insufficient-material"
  | "fifty-move-draw";

// --- constants ------------------------------------------------------------

/** The one place a board dimension is stated, and chess.js states it. */
const BOARD_SIZE: number = new Chess().board().length;

const FIRST_FILE_CODE: number = "a".charCodeAt(0);

const COLORS: Record<ChessColor, Color> = { w: "white", b: "black" };

const PIECE_TYPES: Record<PieceSymbol, PieceType> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const GAME_OVER: readonly StandardGameStatus[] = [
  "checkmate",
  "stalemate",
  "repetition-draw",
  "insufficient-material",
  "fifty-move-draw",
];

// --- squares --------------------------------------------------------------

/** {file: 4, rank: 1} -> "e2" */
export function squareName(square: Square): string {
  return `${String.fromCharCode(FIRST_FILE_CODE + square.file)}${square.rank + 1}`;
}

/** "e2" -> {file: 4, rank: 1} */
export function squareFromName(name: string): Square {
  return {
    file: name.charCodeAt(0) - FIRST_FILE_CODE,
    rank: Number(name.slice(1)) - 1,
  };
}

function onBoard(square: Square): boolean {
  return (
    Number.isInteger(square.file) &&
    Number.isInteger(square.rank) &&
    square.file >= 0 &&
    square.file < BOARD_SIZE &&
    square.rank >= 0 &&
    square.rank < BOARD_SIZE
  );
}

function sameSquare(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

/** Only ever called for a square that has passed `onBoard`. */
function toChessSquare(square: Square): ChessSquare {
  return squareName(square) as ChessSquare;
}

// --- private translation --------------------------------------------------

function toPromotionPiece(
  symbol: PieceSymbol | undefined,
): PromotionPiece | undefined {
  switch (symbol) {
    case "q":
      return "queen";
    case "r":
      return "rook";
    case "b":
      return "bishop";
    case "n":
      return "knight";
    default:
      return undefined;
  }
}

type VerboseMove = {
  from: ChessSquare;
  to: ChessSquare;
  promotion?: PieceSymbol;
  captured?: PieceSymbol;
};

function toStandardMove(move: VerboseMove): StandardMove {
  const promotion = toPromotionPiece(move.promotion);
  const captures =
    move.captured === undefined ? undefined : PIECE_TYPES[move.captured];
  return {
    from: squareFromName(move.from),
    to: squareFromName(move.to),
    ...(promotion === undefined ? {} : { promotion }),
    ...(captures === undefined ? {} : { captures }),
  };
}

/** Long algebraic, the form stored in `history`: "e2e4", "e7e8q". */
function toLongAlgebraic(move: VerboseMove): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function buildBoard(chess: Chess): Board {
  const pieces: Piece[] = [];
  for (const row of chess.board()) {
    for (const entry of row) {
      if (entry === null) continue;
      pieces.push({
        square: squareFromName(entry.square),
        color: COLORS[entry.color],
        type: PIECE_TYPES[entry.type],
      });
    }
  }
  return { size: BOARD_SIZE, pieces };
}

function toGame(chess: Chess, history: readonly string[]): StandardGame {
  return {
    board: buildBoard(chess),
    sideToMove: COLORS[chess.turn()],
    fen: chess.fen(),
    history,
  };
}

/** The position, and nothing else. Used for everything but repetition. */
function load(game: StandardGame): Chess {
  return new Chess(game.fen);
}

/**
 * The whole game from the standard start, so chess.js can count repetitions
 * itself. Returns null when the history cannot reproduce `fen` — a game built
 * by `gameFromFen` did not start from the standard position, so repetition is
 * unknown rather than guessed at.
 */
function replay(game: StandardGame): Chess | null {
  if (game.history.length === 0) return null;
  const chess = new Chess();
  try {
    for (const entry of game.history) {
      const promotion = entry.slice(4, 5);
      chess.move({
        from: entry.slice(0, 2),
        to: entry.slice(2, 4),
        ...(promotion === "" ? {} : { promotion }),
      });
    }
  } catch {
    return null;
  }
  return chess.fen() === game.fen ? chess : null;
}

// --- construction ---------------------------------------------------------

export function newGame(): StandardGame {
  return toGame(new Chess(), []);
}

/**
 * A game at an arbitrary position, for tests and for lesson set-ups. Its
 * `history` is empty, so repetitions from before it are not counted. Throws if
 * `fen` is not a valid position.
 */
export function gameFromFen(fen: string): StandardGame {
  return toGame(new Chess(fen), []);
}

// --- reading --------------------------------------------------------------

export function sideToMove(game: StandardGame): Color {
  return game.sideToMove;
}

export function pieceAt(game: StandardGame, square: Square): Piece | undefined {
  if (!onBoard(square)) return undefined;
  const found = load(game).get(toChessSquare(square));
  if (found === undefined) return undefined;
  return {
    square: { file: square.file, rank: square.rank },
    color: COLORS[found.color],
    type: PIECE_TYPES[found.type],
  };
}

/** Every legal move for the side to move. Empty once the game is over. */
export function legalMoves(game: StandardGame): StandardMove[] {
  if (isGameOver(game)) return [];
  return load(game).moves({ verbose: true }).map(toStandardMove);
}

/**
 * Every legal move for the piece on `from`. Empty for an empty square, a piece
 * of the side not to move, a square off the board, or a finished game. A pawn
 * that can promote yields four moves to the same square, one per piece.
 */
export function legalMovesFrom(
  game: StandardGame,
  from: Square,
): StandardMove[] {
  if (!onBoard(from)) return [];
  if (isGameOver(game)) return [];
  return load(game)
    .moves({ verbose: true, square: toChessSquare(from) })
    .map(toStandardMove);
}

/** Is the side to move's king attacked right now. */
export function isInCheck(game: StandardGame): boolean {
  return load(game).inCheck();
}

export function gameStatus(game: StandardGame): StandardGameStatus {
  const chess = load(game);
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (replay(game)?.isThreefoldRepetition() === true) return "repetition-draw";
  if (chess.isInsufficientMaterial()) return "insufficient-material";
  if (chess.isDrawByFiftyMoves()) return "fifty-move-draw";
  if (chess.inCheck()) return "check";
  return "playing";
}

export function isGameOver(game: StandardGame): boolean {
  return GAME_OVER.includes(gameStatus(game));
}

/** The most recent applied move, for highlighting. Null at the start. */
export function lastMove(game: StandardGame): StandardMove | null {
  const entry = game.history[game.history.length - 1];
  if (entry === undefined) return null;
  const played = replay(game)?.history({ verbose: true });
  const verbose = played?.[played.length - 1];
  if (verbose !== undefined) return toStandardMove(verbose);
  // A history that cannot be replayed still knows where the piece went; it
  // just cannot say what was captured.
  const promotion = toPromotionPiece(entry.slice(4, 5) as PieceSymbol);
  return {
    from: squareFromName(entry.slice(0, 2)),
    to: squareFromName(entry.slice(2, 4)),
    ...(promotion === undefined ? {} : { promotion }),
  };
}

// --- applying -------------------------------------------------------------

/**
 * Apply `move`, matched on from/to/promotion. Returns a new game; `game` and
 * everything reachable from it are untouched. Never throws on bad input.
 */
export function applyMove(game: StandardGame, move: StandardMove): MoveResult {
  if (isGameOver(game)) return { ok: false, reason: "game-over" };
  if (!onBoard(move.from) || !onBoard(move.to)) {
    return { ok: false, reason: "off-board" };
  }

  const chess = load(game);
  const from = toChessSquare(move.from);
  const piece = chess.get(from);
  if (piece === undefined) return { ok: false, reason: "empty-square" };
  if (piece.color !== chess.turn()) return { ok: false, reason: "wrong-side" };

  const match = chess
    .moves({ verbose: true, square: from })
    .find(
      (candidate) =>
        sameSquare(squareFromName(candidate.to), move.to) &&
        toPromotionPiece(candidate.promotion) === move.promotion,
    );
  if (match === undefined) return { ok: false, reason: "illegal-move" };

  chess.move({
    from: match.from,
    to: match.to,
    ...(match.promotion === undefined ? {} : { promotion: match.promotion }),
  });
  return {
    ok: true,
    game: toGame(chess, [...game.history, toLongAlgebraic(match)]),
  };
}
