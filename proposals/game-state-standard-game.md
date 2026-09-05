# Proposal: amend `contracts/game-state.md` for the 8×8 path

Status: **draft for the project lead.** Nothing in `contracts/` has been
edited. If accepted, the text under "Proposed text" is pasted into
`game-state.md` as new sections 16 and 17, and the two one-line edits under
"Edits to existing sections" are applied. If rejected, `standard-game.ts`
stays as it is and the contract stays silent about it, which is the worse of
the two outcomes because the renderer is already calling it.

Drafted 4 Sep 2026, alongside the change it describes.

---

## Why an amendment is needed

`game-state.md` was written when `game.ts` was the only game layer. It says
in §11 that "`board-render` and anything else above this layer use exactly
these" and lists six functions from `game.ts`. That is now false for the
8×8 game: `board.html` calls `standard-game.ts`, which wraps chess.js.

Two paths now exist and the contract names one. Left alone, the next agent
to read §11 will either wire the renderer back to `game.ts` (losing
castling, en passant and promotion) or invent its own account of what the
wrapper promises. Both are the kind of drift contracts exist to stop.

The amendment does not weaken anything. §3–§15 remain true of `game.ts`. The
change is scoping: those sections describe the **variable-board** game
layer, and two new sections describe the **8×8** one.

## What is deliberately not proposed

- **No change to `board-state.md`.** The wrapper reuses `Square`, `Color`,
  `PieceType`, `Piece`, `Board` and `Move` from `moves.ts` unchanged. A
  `StandardMove` is a `Move` with two optional fields; a renderer that only
  knows `Move` still works.
- **No relaxation of §7 or §12 for `game.ts`.** "Storing is not permission"
  still holds there. The 8×8 path gets castling from chess.js, not from
  `game.ts` growing it.
- **No second copy of the rules.** The wrapper computes no chess rule. It
  converts vocabulary in both directions and nothing else.

---

## Edits to existing sections

**§1 title line.** After `## 1 game-state`, add one sentence:

> Sections 3–15 describe the variable-board game layer in `game.ts`.
> Sections 16–17 describe the 8×8 game in `standard-game.ts`. A consumer
> uses one or the other for a given board, never both.

**§11, first paragraph.** Change "`board-render` and anything else above this
layer use exactly these" to "On a variable board, `board-render` and
anything else above this layer use exactly these. On the standard 8×8 board
they use §16 instead."

---

## Proposed text

### 16 The 8×8 path

Full games are played on the standard board, and a full game needs castling,
en passant, promotion, check, checkmate, stalemate and the draws. `moves.ts`
generates none of the first three and was never going to cheaply. For 8×8
only, the rules come from **chess.js** (v1.4.0, BSD-2-Clause), behind the
wrapper `standard-game.ts`.

The wrapper exists so that nothing above it couples to a third-party API.
Three rules, all binding:

1. **`standard-game.ts` is the only file that imports chess.js.** Not the
   renderer, not the bots, not a test above the wrapper. If `new Chess(`
   appears outside `standard-game.ts`, that is a defect.
2. **Nothing from chess.js leaks through an exported type or value.** No
   `'w' | 'b'`, no `'p' | 'n' | ...`, no `Move` class, no algebraic-square
   union type. The exported surface is this project's vocabulary only.
3. **The wrapper computes no chess rule.** It converts and it forwards. A
   rule that chess.js gets wrong is fixed by upgrading chess.js, not by a
   patch in the wrapper.

#### The shape

```ts
type PromotionPiece = "queen" | "rook" | "bishop" | "knight";

type StandardMove = Move & {
  promotion?: PromotionPiece;   // present only on a promotion move
  captures?: PieceType;         // present only when a piece is taken;
                                // "pawn" for en passant although `to` is empty
};

type StandardGame = {
  readonly board: Board;                // size 8, white's perspective, board-state.md rules
  readonly sideToMove: Color;
  readonly fen: string;                 // the position, including clocks
  readonly history: readonly string[];  // every move since the start, "e2e4" / "e7e8q"
};
```

`board` is the same `Board` shape the renderer already draws, derived from
the position on every move. Reading `game.board` to draw is expected. Reading
`game.fen` or `game.history` to decide anything is not; they are there so the
wrapper can rebuild the position and so a game can be serialised later.

`StandardGame` is a value. `applyMove` returns a new one and never mutates
its input, its board, or any piece in it.

#### What a consumer calls

```ts
function newGame(): StandardGame;
function gameFromFen(fen: string): StandardGame;       // lessons and tests; history starts empty
function sideToMove(game: StandardGame): Color;
function pieceAt(game: StandardGame, square: Square): Piece | undefined;
function legalMoves(game: StandardGame): StandardMove[];
function legalMovesFrom(game: StandardGame, from: Square): StandardMove[];
function applyMove(game: StandardGame, move: StandardMove): MoveResult;
function isInCheck(game: StandardGame): boolean;
function gameStatus(game: StandardGame): StandardGameStatus;
function isGameOver(game: StandardGame): boolean;
function lastMove(game: StandardGame): StandardMove | null;
function squareName(square: Square): string;           // {file:4, rank:1} -> "e2"
function squareFromName(name: string): Square;         // "e2" -> {file:4, rank:1}
```

`legalMovesFrom` returns `[]` for an empty square, a piece of the side not
to move, a square off the board, and any square once the game is over.
Everything §11 says about an empty result holds here too: `[]` does not
mean "not your piece".

**Promotion is four moves, not one.** A pawn that can reach its last rank
yields one `StandardMove` per `PromotionPiece`, all with the same `to`. The
renderer groups them by destination, shows one highlight, and when the
child taps it asks which piece before calling `applyMove` with the matching
entry. A promotion move without its `promotion` field is `illegal-move`.

**`applyMove` validates in this order** and returns the first failure:

```ts
type MoveRejection =
  | "game-over"        // no move is legal once the game has ended
  | "off-board"        // a square is not on the 8×8 board
  | "empty-square"     // nothing on move.from
  | "wrong-side"       // that piece belongs to the other player
  | "illegal-move";    // not in legalMovesFrom(game, move.from)

type MoveResult =
  | { ok: true; game: StandardGame }
  | { ok: false; reason: MoveRejection };
```

The first four reasons are §10's, for the same reasons §10 gives. `game-over`
is new: chess.js keeps generating moves for a stalemated or drawn position,
and a renderer must not be able to play on past the end. It never throws
and never returns the input unchanged.

**Status** collapses to one value, first match wins:

```ts
type StandardGameStatus =
  | "checkmate" | "stalemate"
  | "repetition-draw" | "insufficient-material" | "fifty-move-draw"
  | "check" | "playing";
```

Mate outranks every draw, for §11's reason. The three draws are separate
values because the screen says different things for each, and because
collapsing them would hide which rule fired when a test disagrees with
chess.js.

#### How the wrapper answers

Every question except repetition is answered by loading `game.fen` into a
fresh chess.js instance. Repetition replays `game.history` from the standard
start so that chess.js, not this project, decides what "the same position"
means. There is no position key in this file and no history of keys; §9
belongs to `game.ts`.

Cost is one FEN parse per query, which is nothing at one tap per second and
is bounded on the bots' side because they search on chess.js directly (§17).

#### Variable boards

`standard-game.ts` is 8×8 only. `newGame` and `gameFromFen` accept nothing
else and the board size it reports is chess.js's, not a parameter. Anything
with a different size is a lesson and goes through `game.ts`.

### 17 Bots

`bots.ts` chooses a move for the side to move in a `StandardGame`.

```ts
type BotLevel = "random" | "greedy" | "thinking";

function chooseMove(
  game: StandardGame,
  level: BotLevel,
  random?: () => number,          // defaults to Math.random; inject for a deterministic test
): StandardMove | null;           // null only when the side to move has no legal move
```

Pure: `game` is never mutated. The returned move is one that
`legalMoves(game)` would return, so the renderer applies it the same way it
applies the child's tap: `applyMove(game, move)`.

- `random` picks uniformly among legal moves.
- `greedy` takes the highest-value capture available, otherwise random.
- `thinking` is minimax to depth two on material, from the mover's point of
  view. Checkmate delivered is worth more than any material; being mated is
  worth less; stalemate and draws are zero. Ties are broken with `random`.

Material values: pawn 1, knight 3, bishop 3, rook 5, queen 9, king 0.

**One exception to §16 rule 1.** `bots.ts` may import chess.js to search,
because a two-ply search through the wrapper would re-parse a FEN at every
node. It converts the result back to a `StandardMove` before returning and
exports nothing from chess.js. The exception is for search only; the bots
still take and return this project's types.

---

## Open questions for the lead

1. **Should `gameFromFen` be in the contract at all?** Tests need it and
   future lessons on 8×8 positions probably do. It is the one function
   whose argument is a string in someone else's notation. Alternative: keep
   it exported but mark it "tests and lessons only" as drafted above.
2. **Does `game.ts` ever grow castling?** If chess.js is the 8×8 answer for
   good, §7 and §12's "stop if a task requires castling" could be softened
   to "route it to the 8×8 path". Left unchanged in this draft.
