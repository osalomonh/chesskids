# chesskids

A chess app for six-to-nine-year-olds. It runs here:
https://osalomonh.github.io/chesskids/

What this repo is actually about is how it gets
built: a few narrowly scoped AI agents, hard contracts between the layers
they touch, and an eval harness that grades the agents rather than the code
they produce.

## What works today

- **Move generation** for all six pieces. Pseudo-legal, pure, and indifferent
  to board size — the literal `8` appears nowhere, because tier one of the
  curriculum teaches on a 5×5.
- **A game layer.** Turn order, move application, castling and en passant
  memory, and threefold-repetition detection built on a FEN-shaped position
  key.
- **A clickable board.** Tap a piece belonging to the side to move, see its
  legal destinations, tap one, watch the turn flip. Plain HTML and ES modules.
  No framework, no runtime dependencies, nothing to install to look at it.
- **135 assertions** across four suites. Every one of them turns `npm test`
  red on failure.

## What doesn't

This is early, and pretending otherwise would defeat the purpose of publishing
it.

- **No check detection.** None. `applyMove` will happily let you leave your own
  king hanging, because nothing in the system can see that it's attacked.
- **No checkmate or stalemate**, which follow from the above.
- **No castling, en passant, or promotion.** The game layer *remembers*
  castling rights and en passant targets, because a repetition key is wrong
  without them. Remembering is not the same as being allowed to act on it, and
  nothing generates those moves.
- **No accounts, no saved progress, no curriculum wired in.** The curriculum
  exists as a validated contract — 7 tiers, 32 units — and nothing consumes it
  yet.

The deployed board is a 5×5 position with four pieces. It demonstrates the
stack; it is not a game you would want to play.

## The agent architecture

Three agents live in `.claude/agents/`. Each one owns a single file and is
told, in writing, what it may not touch.

| Agent | Owns | Cannot touch |
|---|---|---|
| `move-logic` | `moves.ts` | contracts, the renderer, the reference test suite's expectations |
| `game-flow` | `game.ts` | `moves.ts`, contracts, anything above it |
| `board-render` | `board.html` | `moves.ts`, contracts |

The scoping is the point. An agent with access to everything will fix your
failing test by editing the test.

**Contracts live in `contracts/`.** `board-state.md` defines the move
generation ↔ rendering interface. `game-state.md` defines game state and what
`applyMove` promises. They are owned by a human, they are read-only to every
agent, and an agent that needs one changed is instructed to stop and say so
rather than work around it.

This has already paid for itself. A contract gap — `Piece` carried no type, so
a renderer couldn't know which move function to call — stopped a task before
either agent ran. The fix went contract first, then implementation, then the
consumer. That ordering is cheap on paper and expensive to discover in a
merge.

**Evals live in `evals/`.** `check.ts` inspects a completed agent run and
reports what is actually true: did the typecheck pass, did the tests pass, did
the agent touch a file outside its scope, and is `noUncheckedIndexedAccess`
still switched on. That last assertion exists because the task it grades can be
satisfied by disabling the compiler flag that made the task necessary. Grading
the diff would miss it.

Each assertion was deliberately broken and observed to fail before it was
trusted. A green check you have never seen go red is not evidence.

Runs are manual. `claude -p` is non-interactive, so the permission prompt
raised mid-run has nobody to answer it, and pre-authorising unattended write
access to the repo was not a trade worth making. That's a decision, not a
todo.

## The layer stack

Each layer knows only about the one below it. Nothing reaches up.

| Layer | State |
|---|---|
| Accounts, saved progress | not started |
| Curriculum and activities | contract written, nothing consumes it |
| Rendering (`board.html`) | holds a `GameState`, draws it, turns clicks into moves |
| Game state (`game.ts`) | turn order, move application, repetition history |
| Move generation (`moves.ts`) | six pieces, pure, board-size agnostic |

The renderer never calls `movesFrom` directly — it asks the game layer for
`legalMovesFrom`, because whose turn it is lives there and not on the board.
The game layer never computes a chess rule; it asks `moves.ts`. If a knight
offset ever appears in `game.ts`, something has gone wrong.

## Running it

```
npm install
npm run check      # typecheck, must exit clean
npm test           # all four suites
npm run build      # compile to ESM for the browser
python -m http.server 8000
```

Then open http://localhost:8000/board.html

You need the server. ES modules don't load over `file://`, and the browser
gives you a CORS error rather than anything useful about why.

Compiled JavaScript is not committed. CI typechecks, tests, builds, assembles
`dist/`, and publishes to GitHub Pages — and the deploy step runs only if the
gates pass first.

## The build log

`BUILD_LOG.md` records what happened, including what didn't work.
`PROJECT_STATUS.md` tracks where things stand and what's still open. Both are
written for the person who has to pick this up cold, which is usually me, six
weeks later.
