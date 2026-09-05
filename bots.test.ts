import { test } from "node:test";
import assert from "node:assert";
import { BOT_LEVELS, PIECE_VALUES, chooseMove } from "./bots.js";
import type { BotLevel } from "./bots.js";
import {
  applyMove,
  gameFromFen,
  legalMoves,
  newGame,
  squareFromName,
} from "./standard-game.js";
import type { StandardGame, StandardMove } from "./standard-game.js";

// --- helpers --------------------------------------------------------------

const sq = squareFromName;

/** mulberry32: a tiny seeded generator, so every run makes the same choices. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [1, 2, 3, 7, 42, 1234, 99999];

function sameSquare(a: { file: number; rank: number }, name: string): boolean {
  const b = sq(name);
  return a.file === b.file && a.rank === b.rank;
}

function isSameMove(a: StandardMove, b: StandardMove): boolean {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/** Choose with `level`, asserting purity and that the wrapper accepts the move. */
function chooseAccepted(
  game: StandardGame,
  level: BotLevel,
  seed: number,
): StandardMove {
  const before = structuredClone(game);
  const move = chooseMove(game, level, seeded(seed));
  assert.deepStrictEqual(game, before, `${level} mutated the game`);
  assert.notEqual(move, null, `${level} returned null with moves available`);
  if (move === null) throw new Error("unreachable");

  assert.ok(
    legalMoves(game).some((legal) => isSameMove(legal, move)),
    `${level} returned a move that legalMoves does not list`,
  );
  const result = applyMove(game, move);
  assert.ok(result.ok, `${level}'s move rejected: ${result.ok ? "" : result.reason}`);
  return move;
}

// --- positions ------------------------------------------------------------

const FOOLS_MATE = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
const STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";

/** 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 — an ordinary opening, white to move. */
const TWO_KNIGHTS = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
/** Black to move with a pawn on g2 about to promote; white's b7 pawn answers. */
const PROMOTION_RACE = "8/1P6/8/8/8/8/6pk/K7 b - - 0 1";

/** White: Ra1 can take the undefended queen on a8; e4xd5 is the lesser capture. */
const HANGING_QUEEN = "q3k3/8/8/3p4/4P3/8/8/R3K3 w - - 0 1";
/** White: Nc4 can take the rook on d6; e4xd5 takes only a pawn. */
const ROOK_OR_PAWN = "4k3/8/3r4/3p4/2N1P3/8/8/4K3 w - - 0 1";
/** White: Qd1xd5 wins a pawn but e6xd5 wins the queen back. The only capture. */
const POISONED_PAWN = "4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1";
/** White: the rook on d5 is loose, and it attacks the queen on d1. */
const LOOSE_ROOK = "4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1";
/** White: Re1-e8 is a back-rank mate. */
const BACK_RANK_WHITE = "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1";
/** Black: Re8-e1 is a back-rank mate. */
const BACK_RANK_BLACK = "4r1k1/8/8/8/8/8/PPP5/1K6 b - - 0 1";

// --- constants ------------------------------------------------------------

test("the three levels and the classical piece values are exported", () => {
  assert.deepStrictEqual([...BOT_LEVELS], ["random", "greedy", "thinking"]);
  assert.deepStrictEqual(PIECE_VALUES, {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
  });
});

// --- every level plays a legal move and leaves the game alone -------------

for (const level of BOT_LEVELS) {
  test(`${level}: plays a legal move from the start and mid-game, without mutating`, () => {
    for (const game of [
      newGame(),
      gameFromFen(TWO_KNIGHTS),
      gameFromFen(PROMOTION_RACE),
    ]) {
      for (const seed of SEEDS) chooseAccepted(game, level, seed);
    }
  });

  test(`${level}: keeps the promotion field so a promotion is accepted`, () => {
    // Black's only pawn move is a promotion. Whenever the bot picks it, the
    // move must carry its piece so the wrapper accepts it (chooseAccepted
    // checks acceptance; this checks the field is there).
    const game = gameFromFen(PROMOTION_RACE);
    let promoted = 0;
    for (const seed of SEEDS) {
      const move = chooseAccepted(game, level, seed);
      if (sameSquare(move.from, "g2")) {
        assert.notEqual(move.promotion, undefined);
        promoted += 1;
      }
    }
    if (level === "thinking") {
      assert.ok(promoted > 0, "thinking should promote when it can");
    }
  });

  test(`${level}: returns null on checkmate and stalemate`, () => {
    assert.equal(chooseMove(gameFromFen(FOOLS_MATE), level, seeded(1)), null);
    assert.equal(chooseMove(gameFromFen(STALEMATE), level, seeded(1)), null);
  });

  test(`${level}: the same seed gives the same move`, () => {
    for (const fen of [TWO_KNIGHTS, HANGING_QUEEN, PROMOTION_RACE]) {
      const game = gameFromFen(fen);
      for (const seed of SEEDS) {
        assert.deepStrictEqual(
          chooseMove(game, level, seeded(seed)),
          chooseMove(game, level, seeded(seed)),
        );
      }
    }
  });
}

// --- greedy ---------------------------------------------------------------

test("greedy takes the hanging queen rather than the pawn", () => {
  const game = gameFromFen(HANGING_QUEEN);
  const captures = legalMoves(game).filter((move) => move.captures !== undefined);
  assert.deepStrictEqual(
    captures.map((move) => move.captures).sort(),
    ["pawn", "queen"],
    "the position should offer exactly a pawn and a queen capture",
  );
  for (const seed of SEEDS) {
    const move = chooseAccepted(game, "greedy", seed);
    assert.ok(sameSquare(move.to, "a8"), `seed ${seed} did not take the queen`);
    assert.equal(move.captures, "queen");
  }
});

test("greedy prefers the rook to the pawn", () => {
  const game = gameFromFen(ROOK_OR_PAWN);
  const captures = legalMoves(game).filter((move) => move.captures !== undefined);
  assert.deepStrictEqual(
    captures.map((move) => move.captures).sort(),
    ["pawn", "rook"],
  );
  for (const seed of SEEDS) {
    const move = chooseAccepted(game, "greedy", seed);
    assert.ok(sameSquare(move.to, "d6"), `seed ${seed} did not take the rook`);
    assert.ok(sameSquare(move.from, "c4"));
  }
});

// --- thinking -------------------------------------------------------------

test("thinking leaves the poisoned pawn that greedy grabs", () => {
  const game = gameFromFen(POISONED_PAWN);

  // Sanity-check the position through the wrapper: Qxd5 is the only capture,
  // and black's e6 pawn recaptures.
  const captures = legalMoves(game).filter((move) => move.captures !== undefined);
  assert.equal(captures.length, 1);
  const grab = captures[0];
  assert.ok(grab !== undefined);
  assert.ok(sameSquare(grab.from, "d1") && sameSquare(grab.to, "d5"));
  const afterGrab = applyMove(game, grab);
  assert.ok(afterGrab.ok);
  assert.ok(
    legalMoves(afterGrab.game).some(
      (reply) =>
        sameSquare(reply.from, "e6") &&
        sameSquare(reply.to, "d5") &&
        reply.captures === "queen",
    ),
    "e6xd5 should win the queen",
  );

  for (const seed of SEEDS) {
    const greedy = chooseAccepted(game, "greedy", seed);
    assert.ok(sameSquare(greedy.to, "d5"), `greedy seed ${seed} should grab the pawn`);

    const thinking = chooseAccepted(game, "thinking", seed);
    assert.ok(
      !sameSquare(thinking.to, "d5"),
      `thinking seed ${seed} played the losing Qxd5`,
    );
  }
});

test("thinking takes a loose rook", () => {
  const game = gameFromFen(LOOSE_ROOK);
  for (const seed of SEEDS) {
    const move = chooseAccepted(game, "thinking", seed);
    assert.ok(sameSquare(move.to, "d5"), `seed ${seed} did not take the rook`);
    assert.equal(move.captures, "rook");
  }
});

test("thinking delivers mate in one for either colour", () => {
  for (const [fen, from, to] of [
    [BACK_RANK_WHITE, "e1", "e8"],
    [BACK_RANK_BLACK, "e8", "e1"],
  ] as const) {
    const game = gameFromFen(fen);
    for (const seed of SEEDS) {
      const move = chooseAccepted(game, "thinking", seed);
      assert.ok(
        sameSquare(move.from, from) && sameSquare(move.to, to),
        `${fen} seed ${seed}: expected ${from}${to}`,
      );
    }
  }
});
