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

A renderer displaying the board for a black player flips it on the way to the
screen:

```ts
const ranksTopToBottom = playingAs === "white"
  ? [...ranks].reverse()
  : ranks;
```

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
pawnMoves(from: Square, board: Board, color: Color): Square[]
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

Consumers must not assume the returned squares are in any particular order.

---

## Deliberately not in board state

`Board` describes a position. It does not describe a game or a screen.

Not present, and not to be added without a change to this document:

| Absent | Belongs to |
|---|---|
| Whose turn it is | game state |
| Move history | game state |
| Check / checkmate / stalemate | a future rules layer |
| Castling rights, en passant target | a future rules layer |
| Which square is selected | rendering |
| Which squares are highlighted | rendering |
| Board orientation | rendering |
| Animation, drag position, hover | rendering |

The most likely violation is a renderer wanting somewhere to put
`selectedSquare` and adding it to `Board` because that is convenient. Don't.
Selection is screen state and lives with the screen.

---

## Known gaps

These are real and unresolved. A consumer will hit them.

**1. ~~`Piece` has no type.~~ Resolved 3 Sep 2026.**

`Piece` now carries a required `type`. A renderer can draw a board from
`Board` alone, and can choose which move function to call from the piece
itself.

Dispatch from `type` to a move function lives in the consumer, not here.
`moves.ts` exports six functions and does not choose between them. If more
than one consumer ends up writing the same switch, that is the signal to add
a dispatcher to `moves.ts` — and that would be another change to this
document.

**2. `pawnMoves` has a different signature.**

Five functions take `(from, board)`. The pawn takes `(from, board, color)`,
because pawn direction depends on colour and the pawn function predates
colour existing on `Piece`. Now that pieces carry colour, this parameter is
redundant and inconsistent.

**3. Empty-square behaviour is undefined-ish.**

The five non-pawn functions look up the mover's colour from the board. When
`from` holds no piece, there is no colour, and the current implementation
treats every occupied square as capturable. So asking for `rookMoves` on an
empty square returns moves for a piece that isn't there.

Undecided whether this should return `[]` instead. Several existing tests
rely on the current behaviour.

**4. Not implemented.**

Castling, en passant, promotion, check detection. En passant needs move
history in `Board`; promotion needs a return type richer than `Square[]`.
Both are contract changes, not missing logic.

---

## Changing this document

A change here is a change to an interface two or more agents depend on.

1. The agent that needs the change states what it needs and why, and stops.
2. The project lead decides and edits this file.
3. Consumers are updated to match.

An agent that finds this document inconsistent with `moves.ts` should report
the inconsistency rather than assuming either one is correct.