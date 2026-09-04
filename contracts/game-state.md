## 1 game-state

## 2 Why this exists

`board-state.md` describes a position. Where the pieces are. That's it.

That's not a flaw in board-state — it's the correct division. A position is a
photograph. A game is everything the photograph can't show you.

Four things live here because they cannot live there:

1. **Whose turn it is.** The same arrangement of pieces is two entirely
   different situations depending on who moves next. One is winning. One is
   losing. The pieces don't know.
2. **Castling rights.** A king that moved to e2 and came back to e1 looks
   exactly like a king that never moved. The board has no memory. We do.
3. **En passant availability.** It depends on the move *immediately* before
   this one, and it expires after a single turn. Nothing on the board
   records it and nothing on the board forgets it.
4. **Repetition.** A draw by threefold repetition requires knowing that this
   exact situation has happened twice already. That's history, not geometry.

Every one of these is memory. Board-state has none. This is the memory.

## 3 The shape

```ts
type GameState = {
  board: Board;                    // from board-state.md, unchanged
  sideToMove: Color;
  castling: CastlingRights;
  enPassantTarget: Square | null;
  history: PositionKey[];
};
```

The board goes in whole. We don't copy pieces out of it, we don't shadow it,
we don't keep a second opinion about where the rooks are. Board-state owns
squares. We own everything squares can't say.

`Board`, `Square`, `Color`, and `Move` come from `moves.ts`. They are not
redefined here. If one of them doesn't exist there, stop and ask — don't
invent it.

## 4 sideToMove

`'white' | 'black'`. Strict alternation. It flips on every applied move and
at no other time.

There's no "current player" object, no turn counter to divide by two, no
clever derivation from history length. One field. Flip it.

## 5 castling

```ts
type CastlingRights = {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
};
```

Four booleans. Not a set, not a string, not flags on the pieces.

You'll be tempted to derive this from a `hasMoved` field on the king and
rooks. Don't. When a rook gets captured on its home square, the piece leaves
the board and takes its history with it — and the right is supposed to be
gone *forever*, including if you somehow get another rook there. State that
lives on a piece dies with the piece. This state has to outlive it.

Rights only ever go from `true` to `false`. There is no path back. Anything
that sets one of these to `true` after the game starts is a bug.

**One case is specified but not implementable yet.** A right must also
narrow when a rook is *captured* on its home square — the piece never moved,
so nothing on the board changed to signal it, and the right is still supposed
to die. Detecting that requires knowing which squares are home squares, and
on a variable board those aren't fixed coordinates. `GameState` does not
currently record them.

The rule stands as written. The mechanism for this one case does not exist.
Track the moved-piece cases correctly and stop if a task depends on the
capture case.

## 6 enPassantTarget

The square a pawn *skipped over*, or `null`.

Not "did the last move happen to be a double push" — the square itself. That
sounds like a small difference. It isn't. Storing the square means the
answer is already computed for whoever needs it, and it means the field
carries exactly one meaning.

Set it on a double pawn push. Set it to `null` on every other move. It is
never stale, because it's rewritten on every single move whether it changed
or not.

## 7 Why castling and en passant are here at all

Read this before you decide either field is dead weight.

`moves.ts` does not generate castling moves and does not generate en passant
captures. Both are out of scope. So nothing in this system will ever *use*
these fields to move a piece, and by the reasoning further down this file —
adding state nobody reads is how contracts rot — you'd expect them cut.

They stay because `PositionKey` needs them. Repetition detection is wrong
without them, and repetition is the only draw this layer can see. They are
maintained for **position identity**, not because castling is coming.

Two consequences, both binding:

- They must be maintained *correctly* even though no move generator consults
  them. "Nothing reads it, so approximate it" produces a subtly wrong key,
  and a subtly wrong key produces wrong draws. Track them properly.
- Their presence is not permission. Storing en passant state does not
  authorize generating en passant captures, and storing castling rights does
  not authorize castling. Remembering something is not the same as being
  allowed to act on it. If a task requires either move, stop and say so.

## 8 history

A list of `PositionKey`. Append one entry per move applied. Three
occurrences of the same key means the position has repeated three times.

## 9 ositionKey

This is the part people get wrong, so read it twice.

Two positions are the same position when the pieces match **and**:

- the same side is to move
- the same castling rights survive
- the same en passant target is available

If any of those differ, they are different positions and they don't count
toward repetition. A key built from piece placement alone is not a bug you
find later. It's a bug you never find, because it produces draws that look
almost right.

So the key is a string built from all four. Piece placement, side to move,
castling rights, en passant target. FEN does it this way and FEN has been
right about it since before any of us were here.

## 10 applyMove

The only operation that advances a game.

```ts
type MoveResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: MoveRejection };

type MoveRejection =
  | 'empty-square'      // no piece on move.from
  | 'wrong-side'        // that piece belongs to the other player
  | 'illegal-move'      // not in the list moves.ts returned
  | 'off-board';        // a square isn't on this board

function applyMove(state: GameState, move: Move): MoveResult;
```

It takes a `Move` — the same `Move` that `moves.ts` returns, not a pair of
squares. The caller got the move from `movesFrom`; it hands the same object
back. No re-parsing, no reconstructing.

**It validates.** Every time. In this order:

1. Both squares are on the board.
2. `move.from` holds a piece.
3. That piece's colour is `state.sideToMove`.
4. The move appears in `movesFrom(move.from, state.board)`.

Step 4 is a call into `moves.ts`. This layer does not decide what's legal; it
asks. If you find yourself writing a knight offset in `game.ts`, you've gone
wrong.

**Illegal input returns `{ ok: false }`.** It does not throw, and it does not
return the state unchanged.

Not throwing, because a rejected move crosses a layer boundary on its way to
a renderer that will be handling a six-year-old's misplaced tap. That's a
value, not an exception. Wrapping every tap in a try/catch is how you end up
swallowing real bugs alongside fat fingers.

Not returning the state unchanged, because a caller that doesn't compare
objects can't tell that apart from success. Silent failure in the layer whose
entire job is remembering things correctly is the worst option on the table.

A result type makes rejection something you have to unwrap before you can use
what's inside. That's the point.

**On success it returns a new `GameState`** with:

- the piece moved on a new board
- `sideToMove` flipped
- `castling` narrowed if a king or rook left its home square
- `enPassantTarget` set to the skipped square on a double pawn push, `null`
  otherwise
- the new position's `PositionKey` appended to `history`

The `GameState` passed in comes back untouched, and so does every piece
inside its board.

## 11 What a consumer calls

`board-render` and anything else above this layer use exactly these. Nothing
reaches into `GameState` to compute chess answers by hand.

```ts
function sideToMove(state: GameState): Color;
function legalMovesFrom(state: GameState, from: Square): Move[];
function isRepetitionDraw(state: GameState): boolean;
function applyMove(state: GameState, move: Move): MoveResult;
```

`legalMovesFrom` returns `[]` when the square is empty or holds a piece
belonging to the side not to move. That's the turn filter, and it lives here
because turn order lives here. The renderer must not call `movesFrom`
directly — it has no way to know whose turn it is.

`isRepetitionDraw` counts occurrences of `history[history.length - 1]` — the
key `applyMove` appended for the current position. It does not recompute the
key from `state`.

Two ways to get the same number is one way too many. If the recomputed key
ever disagrees with the stored one, you get a wrong draw and no trail back to
why. There is one key per position and `applyMove` is what makes it.

Returns `false` on an empty history.

Reading `state.board` to draw the pieces is fine and expected. Reading
`state.castling` to decide anything is not.

## 12 What this contract does not do

**No legality beyond pseudo-legal.** `moves.ts` does not detect check. That
means nothing here can determine checkmate, stalemate, or whether a move
leaves a king attacked. `applyMove` will happily accept a move that hangs a
king, because it has no way to know. This contract does not pretend
otherwise and neither should anything reading it.

**No move generation.** Not one square. Every question about where a piece
may go is answered by calling into `moves.ts`.

**No mutation.** Covered above, repeated here because it's the invariant most
likely to be broken quietly.

## 13 Variable boards

`board.size` is the only source of dimensions. The literal 8 does not appear.

Castling has no obvious meaning on a 5×5 board, and en passant barely has
one. The fields are still here and still valid — they'll simply be `false`
and `null` on the small boards, and nothing has to special-case anything.
Whether castling is ever *offered* on a non-standard board is a question for
later. The answer is probably no.

## 14 Depends on

This contract cannot be implemented until `moves.ts` provides two things it
does not have today:

- **`Move`** — at minimum `{ from: Square; to: Square }`.
- **`movesFrom(board, from)`** — reads the piece's type and dispatches to the
  right generator, returning `Move[]`.

`board-state.md` currently places dispatch in the consumer. Amending that is
a prerequisite, not something to work around. The six per-piece functions
keep their `Square[]` signatures and their existing tests; `movesFrom` wraps
them. Additive, so no expectation in `test.ts` changes.

Order: amend `board-state.md`, have `move-logic` add `Move` and `movesFrom`,
then this layer starts.

## 15 Known gaps

- **Fifty-move rule.** Not represented. It needs a halfmove clock that resets
  on captures and pawn moves. It isn't here because nothing has needed it,
  and adding state nobody reads is how contracts rot.
- **En passant nuance.** FIDE only counts en passant toward repetition when
  the capture is actually legal for the side to move. We record the target
  square unconditionally. This can under-report threefold repetition in rare
  positions. Accepted, deliberately, and written down so it isn't
  rediscovered as a mystery.
- **Termination.** Repetition is the only draw this state can see. Checkmate,
  stalemate, and insufficient material all wait on check detection.
- **Castling rights on capture.** Specified in the castling section, not
  implementable until `GameState` records home squares. Unresolved.