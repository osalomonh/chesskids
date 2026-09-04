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
  | 'illegal-move'      // not a legal move for the side to move
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
4. The move appears in `legalMovesFrom(state, move.from)`.

Step 4 was a call into `moves.ts` and is now a call into §12. `moves.ts` still
answers where a piece may go; this layer decides whether that move is allowed
once the mover's own king is accounted for. If you find yourself writing a
knight offset in `game.ts`, you've still gone wrong.

`illegal-move` now covers a move that leaves the mover's own king attacked.
There is deliberately **no new rejection reason** for it. To a renderer
handling a six-year-old's tap, "that piece can't go there" and "that would
hang your king" are the same event, and a separate reason only exists to tempt
the caller into explaining chess. The explanation belongs in the UI copy, not
the result type.

**One rule, binding.** The legality filter applies a move to a copy of the
board. It must **not** do that by calling `applyMove`, because `applyMove`
calls the filter and you get unbounded recursion on the first tap. Factor the
board transition — move the piece, remove a capture — into one private
function, and have both `applyMove`'s success path and the filter call that.
One transition, two callers, no cycle.

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
function isInCheck(state: GameState): boolean;
function gameStatus(state: GameState): GameStatus;
function isRepetitionDraw(state: GameState): boolean;
function applyMove(state: GameState, move: Move): MoveResult;
```

`legalMovesFrom` returns `[]` when the square is empty or holds a piece
belonging to the side not to move. That's the turn filter, and it lives here
because turn order lives here. It now also drops any move that would leave the
mover's own king attacked — see §12.

An empty result therefore no longer means "not your piece". A pinned piece is
yours, on your turn, with pseudo-legal moves, and correctly offers none.
Anything reading `[]` as "wrong colour" is now wrong.

The renderer must not call `movesFrom` directly — it has no way to know whose
turn it is, and now no way to know what's legal either.

`isInCheck` answers one question: is the king of `state.sideToMove` attacked
right now. Not the other side's king — if you want that, you are asking a
different question and should say so rather than flipping a field to fake it.
Returns `false` when that side has no king on the board, which is the normal
case on the small teaching boards.

`gameStatus` collapses the above into the one value a screen actually needs:

```ts
type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'repetition-draw';
```

First match wins, in this order:

1. no legal moves and `isInCheck` → `checkmate`
2. no legal moves and not in check → `stalemate`
3. `isRepetitionDraw` → `repetition-draw`
4. `isInCheck` → `check`
5. otherwise → `playing`

Mate outranks repetition because mate ends the game where it stands. A
position that is checkmate is not a draw that happens to also be mate, and a
status function that returns `repetition-draw` for a mated king is telling the
child something false.

"No legal moves" means every piece of the side to move returns `[]` from
`legalMovesFrom`. Defined that way on purpose: one source of legality, asked
the same way by everything.

`isRepetitionDraw` counts occurrences of `history[history.length - 1]` — the
key `applyMove` appended for the current position. It does not recompute the
key from `state`.

Two ways to get the same number is one way too many. If the recomputed key
ever disagrees with the stored one, you get a wrong draw and no trail back to
why. There is one key per position and `applyMove` is what makes it.

Returns `false` on an empty history.

Reading `state.board` to draw the pieces is fine and expected. Reading
`state.castling` to decide anything is not.

## 12 What "legal" means

Three conditions, all required:

1. `moves.ts` generated it.
2. The piece belongs to the side to move.
3. Playing it does not leave the mover's own king attacked.

The first is geometry and belongs below this layer. The second and third are
rules about a *game*, and both live here.

**`moves.ts` does not change.** It still generates pseudo-legal moves and
still knows nothing about check. The filter is built on top of it by calling
it more often. Nothing is added to `board-state.md` by this amendment.

### The algorithm

For each pseudo-legal move from `movesFrom`: apply it to a copy of the board,
ask whether the mover's king is attacked in the resulting position, and
discard the move if it is.

"Is this king attacked" is answered by generating every enemy piece's moves
and checking whether any lands on the king's square. There is no attack table
and no per-piece attack function. The move generator already knows what every
piece can reach; asking it again is one call, and a second implementation of
the same knowledge is a second thing to keep correct.

**On pawns, which is where this normally breaks.** Using `movesFrom` for
attack detection would seem wrong for pawns, since a pawn's forward push is a
move but not an attack. It is fine here, and for a specific reason:
`pawnMoves` only generates a forward push onto an *empty* square. A king
occupies the square being tested, so a push can never be generated onto it,
and only the diagonal captures survive. Do not add a pawn special case to
"fix" this. It is already right, and the special case would be the bug.

**No king, no check.** A board with no king of the moving colour is not in
check and filters nothing. The teaching boards in tier 1 have no kings, and
most of the existing test positions don't either. This is the ordinary case,
not an edge case to guard against.

### Cost

Every legality query is roughly (pseudo-legal moves) × (enemy pieces) ×
(their moves). On a 5×5 board with four pieces that is nothing, and on 8×8 it
is still nothing at one query per tap.

Do not cache it. A cached legal-move set is a second source of truth about the
position, and this layer already has one rule about that: there is one key per
position, and there is one answer about legality. Both are computed where
they're asked for.

### Repetition is unaffected

`PositionKey` does not change. Legality is derived from a position; it is not
part of a position's identity, and two positions with identical placement,
side to move, castling rights and en passant target are the same position
whether or not someone is in check.

### Still out of scope

**Castling, en passant, and promotion remain unimplemented and unpermitted.**
Check detection does not unlock them. `moves.ts` generates none of the three,
so none of the three can appear in a legal move list, and §7 stands
unchanged: storing castling rights and an en passant target is for position
identity, not permission. If a task requires one of those moves, stop and say
so.

## 13 What this contract does not do

**No legality beyond this layer.** `moves.ts` still does not detect check, and
still returns moves that hang a king. That is correct and it stays that way.
Every legality question above pseudo-legal — your turn, your king — is
answered here, by §12, and by nothing else. A consumer that wants to know
whether a move is allowed calls `legalMovesFrom` or reads the result of
`applyMove`.

**No move generation.** Not one square. Every question about where a piece
may go is answered by calling into `moves.ts`.

**No mutation.** Covered above, repeated here because it's the invariant most
likely to be broken quietly.

## 14 Variable boards

`board.size` is the only source of dimensions. The literal 8 does not appear.

Castling has no obvious meaning on a 5×5 board, and en passant barely has
one. The fields are still here and still valid — they'll simply be `false`
and `null` on the small boards, and nothing has to special-case anything.
Whether castling is ever *offered* on a non-standard board is a question for
later. The answer is probably no.

## 15 Depends on

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

## 16 Known gaps

- **Fifty-move rule.** Not represented. It needs a halfmove clock that resets
  on captures and pawn moves. It isn't here because nothing has needed it,
  and adding state nobody reads is how contracts rot.
- **En passant nuance.** FIDE only counts en passant toward repetition when
  the capture is actually legal for the side to move. We record the target
  square unconditionally. This can under-report threefold repetition in rare
  positions. Accepted, deliberately, and written down so it isn't
  rediscovered as a mystery.
- **Insufficient material.** Not detected. A bare king against a bare king is
  a draw and this layer will report `playing` forever. It needs a material
  scan, not check detection, and nothing has needed it yet.
- **Castling rights on capture.** Specified in the castling section, not
  implementable until `GameState` records home squares. Unresolved.