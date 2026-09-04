# Board state contract

The interface between move generation and everything above it.

`moves.ts` produces board state. The renderer, the activities, and eventually
the puzzle generator consume it. This document is what both sides read so
neither has to guess, and neither may change it alone.

Owned by the project lead. An agent that needs a change here stops and says
so rather than editing this file or working around it.

---

## Types

These live in `moves.ts` today and are exported from there. This document
describes them; it does not duplicate them.

```ts
type Square    = { file: number; rank: number };
type Color     = "white" | "black";
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
type Piece     = { square: Square; color: Color; type: PieceType };
type Board     = { size: number; pieces: Piece[] };
type Move = { from: Square; to: Square };
```

`Board` is a complete description of a position. Nothing else is needed to
compute what moves exist, or to draw it.

`type` is required. A piece without one is not a piece.

---

## Coordinates

`file` is the column. `rank` is the row. Both are 0-indexed.

`{file: 0, rank: 0}` is white's bottom-left corner. `{file: size-1,
rank: size-1}` is black's top-right.

White pawns move toward increasing rank. Black pawns move toward decreasing
rank. This is fixed and does not depend on anything.

Boards are square. `board.size` is the only source of dimensions. The literal
`8` does not appear in move-generation code, and a consumer must not assume
it either — tier 1 lessons use 5×5 boards.

---

## Orientation belongs to the renderer

Board state is always described from white's perspective. Rank 0 is white's
home rank in the data, always, regardless of who is playing or what the
screen shows.

A renderer displaying the board for a black player turns it around on the way
to the screen. That is a 180-degree rotation, so **both** orders reverse:

```ts
const ranksTopToBottom = playingAs === "white"
  ? [...ranks].reverse()
  : ranks;

const filesLeftToRight = playingAs === "white"
  ? files
  : [...files].reverse();
```

Reversing ranks alone is a mirror, not a rotation: it leaves each player's
king and queen swapped left-for-right. On a standard 8x8 start, read each
player's own back rank left to right from where they sit — white sees queen
4th and king 5th, black sees king 4th and queen 5th. If the queen is 4th in
both views, the board has been mirrored.

Coordinates are never transformed. A `{file, rank}` pair means the same
square in either view; only the draw order changes.

That is a rendering decision made in the rendering layer. `Board` never
carries an orientation, and no function in `moves.ts` accepts one.

Rationale: one canonical description, many possible views. If board state
carried orientation, the same position stored two ways would produce two
different sets of legal moves, and that class of bug is very hard to find.

---

## What the move functions promise

```ts
kingMoves(from: Square, board: Board): Square[]
knightMoves(from: Square, board: Board): Square[]
rookMoves(from: Square, board: Board): Square[]
bishopMoves(from: Square, board: Board): Square[]
queenMoves(from: Square, board: Board): Square[]
pawnMoves(from: Square, board: Board): Square[]
```

Each returns the squares a piece at `from` may move to.

Guarantees:

- **Pure.** Same inputs, same output. The input `Board` is never mutated.
- **On-board.** Every returned square satisfies `0 <= file < size` and
  `0 <= rank < size`.
- **Friendly pieces block.** A square occupied by a piece of the mover's own
  colour is never returned, and a sliding piece stops before it.
- **Enemy pieces are capturable.** A square occupied by an enemy piece is
  returned, and a sliding piece stops there.
- **Pseudo-legal only.** These do not consider check. A move that would leave
  the mover's own king in check is still returned.
- **No piece at `from` means no moves.** If `from` holds no piece, there is no
  mover and no colour to reason about, so every function returns `[]` rather
  than generating moves for a piece that isn't there.

Consumers must not assume the returned squares are in any particular order.

---

// NEW — entire section. Added 4 Sep 2026 in response to gap 1 below.

## Dispatch

```ts

movesFrom(from, board): Move[]


```

`movesFrom` reads the piece at `from`, dispatches to the matching function
above, and wraps each returned square as a `Move`.

Argument order matches the six functions above: `from` first, `board` second.

It is additive. The six per-piece functions keep their `Square[]` signatures
and their existing tests. `movesFrom` wraps them; it does not replace them
and does not reimplement any of their logic.

Guarantees are inherited from whichever function it dispatches to, plus:

- **Empty `from` returns `[]`.** No piece, no dispatch.
- **`from` is echoed.** Every `Move` in the result has `move.from` equal to
  the `from` argument.

Why a `Move` rather than a bare `Square`: the game layer receives a move back
from a caller and applies it. A destination square alone doesn't say where
the piece came from, so the caller would have to carry the origin separately
and the two could disagree. One object, both ends, no chance to mismatch.

`Move` carries nothing else. Not `isCapture`, not `isPromotion`, not a piece
reference. Anything derivable from `from`, `to`, and the board does not go in
the move.

Two things to get right when implementing it:

`Board` holds `pieces: Piece[]`, and each `Piece` carries its own `square`.
There is no square-indexed array. A consumer looking up "what is on this
square" scans the list. `movesFrom` does the same.

Board size is `board.size` and boards are square. `movesFrom` adds no
dimension assumptions of its own.

---

## Deliberately not in board state

`Board` describes a position. It does not describe a game or a screen.

Not present, and not to be added without a change to this document:

// CHANGED — all four rows now name game-state.md instead of "a future
// rules layer". The check row moved last, on 4 Sep 2026, when
// game-state.md gained its legality section.

| Absent | Belongs to |
|---|---|
| Whose turn it is | `contracts/game-state.md` |
| Move history | `contracts/game-state.md` |
| Castling rights, en passant target | `contracts/game-state.md` |
| Check / checkmate / stalemate | `contracts/game-state.md` |
| Which square is selected | rendering |
| Which squares are highlighted | rendering |
| Board orientation | rendering |
| Animation, drag position, hover | rendering |

The most likely violation is a renderer wanting somewhere to put
`selectedSquare` and adding it to `Board` because that is convenient. Don't.
Selection is screen state and lives with the screen.

// NEW — paragraph. Second violation now plausible because a game layer exists.

The second most likely violation is a game layer wanting to store
`sideToMove` on the `Board` so that `movesFrom` can filter by turn. Don't.
`movesFrom` answers what a piece can do, not whether it may. The turn filter
is `legalMovesFrom` in the game layer.

---

## Known gaps

These are real and unresolved. A consumer will hit them.

**1. ~~`Piece` has no type.~~ Resolved 3 Sep 2026.**

`Piece` now carries a required `type`. A renderer can draw a board from
`Board` alone, and can choose which move function to call from the piece
itself.

// CHANGED — replaces the paragraph that said dispatch lives in the consumer.
// That paragraph named the condition for moving it; the condition was met.

Dispatch from `type` to a move function lived in the consumer until 4 Sep
2026. Two consumers needed it — the renderer, to know what a tapped piece can
do, and the game layer, to validate a move before applying it. That is the
signal this gap named, so dispatch moved into `moves.ts`. See *Dispatch and
the `Move` type* above.

**2. ~~`pawnMoves` has a different signature.~~ Resolved 4 Sep 2026.**

All six move functions now take `(from, board)`. `pawnMoves` looks up the
mover's colour from the board via the same `moverColor` helper the other
five use, instead of taking it as a separate parameter.

**3. ~~Empty-square behaviour is undefined-ish.~~ Resolved 4 Sep 2026.**

All six functions look up the mover's colour from the board. When `from`
holds no piece, there is no colour, and now no function generates moves for
a piece that isn't there: `kingMoves`, `knightMoves`, `rookMoves`,
`bishopMoves`, `queenMoves`, and `pawnMoves` all return `[]` for an empty
`from` square. Previously the five non-pawn functions treated every
occupied square as capturable in that case, so `rookMoves` on an empty
square returned moves for a piece that wasn't there.

// CHANGED — promotion reasoning was half-obsolete once Move[] existed;
// en passant paragraph now points at where the state actually lives.

**4. Not implemented.**

Castling, en passant, promotion, check detection.

Promotion previously needed a return type richer than `Square[]`. `Move[]`
is that type — adding an `isPromotion` field is now a small change rather
than a structural one. It is still unimplemented and still a contract change.

En passant needs move history, which `Board` does not have and will not get;
it lives in `GameState`. Note that `contracts/game-state.md` stores an en
passant target and castling rights for position identity only. Storing them
does not authorize generating those moves, and `moves.ts` generates neither.

---

## Changing this document

A change here is a change to an interface two or more agents depend on.

1. The agent that needs the change states what it needs and why, and stops.
2. The project lead decides and edits this file.
3. Consumers are updated to match.

An agent that finds this document inconsistent with `moves.ts` should report
the inconsistency rather than assuming either one is correct.