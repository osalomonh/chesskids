// bots.ts — a computer opponent for the 8x8 game, in three strengths.
//
// `chooseMove` picks a move for the side to move in a `StandardGame`. Every
// returned move is one `legalMoves(game)` would return, so the renderer applies
// it exactly as it applies the child's tap: `applyMove(game, move)`.
//
// `random` and `greedy` work purely through `standard-game.ts`. `thinking`
// searches two plies and, as allowed by proposals/game-state-standard-game.md
// §17, does so on chess.js directly: going through the wrapper would re-parse
// a FEN at every node. chess.js stays internal to this file — nothing of its
// API leaves through an export.

import { Chess } from "chess.js";
import type { PieceSymbol } from "chess.js";
import type { PieceType } from "./moves.js";
import type {
  PromotionPiece,
  StandardGame,
  StandardMove,
} from "./standard-game.js";
import { legalMoves, squareName } from "./standard-game.js";

// --- public types and constants -------------------------------------------

export type BotLevel = "random" | "greedy" | "thinking";

export const BOT_LEVELS: readonly BotLevel[] = ["random", "greedy", "thinking"];

/** Classical material values. The king is 0: it is never captured. */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

// --- private constants ----------------------------------------------------

/** Above any material swing a board can hold (all 15 capturable pieces < 104). */
const MATE_SCORE = 1000;

/** Our promotion names -> chess.js letters. */
const PROMOTION_LETTERS: Readonly<Record<PromotionPiece, PieceSymbol>> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

/** chess.js piece letters -> our names. */
const PIECE_TYPES: Readonly<Record<PieceSymbol, PieceType>> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

// --- helpers --------------------------------------------------------------

/** Uniform pick. `random` must return a number in [0, 1). */
function pickRandom<T>(items: readonly T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

/** All items whose score equals the maximum. */
function bestBy<T>(items: readonly T[], score: (item: T) => number): T[] {
  let best = -Infinity;
  let winners: T[] = [];
  for (const item of items) {
    const value = score(item);
    if (value > best) {
      best = value;
      winners = [item];
    } else if (value === best) {
      winners.push(item);
    }
  }
  return winners;
}

function captureValue(move: StandardMove): number {
  return move.captures === undefined ? 0 : PIECE_VALUES[move.captures];
}

// --- random and greedy ----------------------------------------------------

function chooseRandom(
  moves: readonly StandardMove[],
  random: () => number,
): StandardMove | null {
  return pickRandom(moves, random) ?? null;
}

/** The highest-value capture on offer; a random move when nothing can be taken. */
function chooseGreedy(
  moves: readonly StandardMove[],
  random: () => number,
): StandardMove | null {
  const captures = moves.filter((move) => move.captures !== undefined);
  if (captures.length === 0) return chooseRandom(moves, random);
  return pickRandom(bestBy(captures, captureValue), random) ?? null;
}

// --- thinking: two-ply minimax on material --------------------------------

/**
 * Material from the bot's point of view: its pieces minus the opponent's.
 * Read from the wrapper's board once, at the root; the search then adjusts it
 * incrementally from what each move captures or promotes to.
 */
function rootMaterial(game: StandardGame): number {
  let total = 0;
  for (const piece of game.board.pieces) {
    const value = PIECE_VALUES[piece.type];
    total += piece.color === game.sideToMove ? value : -value;
  }
  return total;
}

/** How much a move raises its mover's material: what it takes plus what it becomes. */
function materialGain(
  captured: PieceSymbol | undefined,
  promotion: PieceSymbol | undefined,
): number {
  const taken = captured === undefined ? 0 : PIECE_VALUES[PIECE_TYPES[captured]];
  const grown =
    promotion === undefined
      ? 0
      : PIECE_VALUES[PIECE_TYPES[promotion]] - PIECE_VALUES.pawn;
  return taken + grown;
}

/**
 * Score of a finished position, from the bot's point of view, or undefined if
 * play goes on. `botToMove` says whose turn it is in `chess` right now; a
 * checkmated side is always the side to move.
 */
function terminalScore(chess: Chess, botToMove: boolean): number | undefined {
  if (chess.isCheckmate()) return botToMove ? -MATE_SCORE : MATE_SCORE;
  if (chess.isDraw()) return 0;
  return undefined;
}

/**
 * Score of the position after the bot's move, assuming the opponent picks the
 * reply that is worst for the bot. `position` has the opponent to move;
 * `material` is from the bot's point of view after the bot's move.
 *
 * Each leaf is loaded from the `after` FEN chess.js computes for every verbose
 * move anyway. That is several times cheaper than `move()` + `undo()`, which
 * would regenerate all legal moves and build SAN just to step forward.
 */
function scoreAfterBotMove(position: Chess, material: number): number {
  const finished = terminalScore(position, false);
  if (finished !== undefined) return finished;

  let worst = Infinity;
  for (const reply of position.moves({ verbose: true })) {
    const leaf =
      terminalScore(new Chess(reply.after), true) ??
      material - materialGain(reply.captured, reply.promotion);
    if (leaf < worst) worst = leaf;
  }
  return worst;
}

/** Look one move ahead for each side and take the move with the best worst case. */
function chooseThinking(
  game: StandardGame,
  moves: readonly StandardMove[],
  random: () => number,
): StandardMove | null {
  if (moves.length === 0) return null;
  const material = rootMaterial(game);

  // The root list is the wrapper's own, so the chosen move is exactly what
  // `legalMoves(game)` returned; chess.js only scores it. A fresh Chess per
  // root move keeps the search free of undo bookkeeping.
  const scored = moves.map((move) => {
    const promotion =
      move.promotion === undefined ? undefined : PROMOTION_LETTERS[move.promotion];
    const position = new Chess(game.fen);
    const played = position.move({
      from: squareName(move.from),
      to: squareName(move.to),
      ...(promotion === undefined ? {} : { promotion }),
    });
    const score = scoreAfterBotMove(
      position,
      material + materialGain(played.captured, played.promotion),
    );
    return { move, score };
  });

  const best = bestBy(scored, (entry) => entry.score);
  return pickRandom(best, random)?.move ?? null;
}

// --- entry point ----------------------------------------------------------

/**
 * Pick a move for the side to move. Null only when there is no legal move.
 * Pure: `game` is never touched. Deterministic for a given `random`.
 */
export function chooseMove(
  game: StandardGame,
  level: BotLevel,
  random: () => number = Math.random,
): StandardMove | null {
  const moves = legalMoves(game);
  switch (level) {
    case "random":
      return chooseRandom(moves, random);
    case "greedy":
      return chooseGreedy(moves, random);
    case "thinking":
      return chooseThinking(game, moves, random);
  }
}
