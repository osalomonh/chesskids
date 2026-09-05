# chesskids

A chess app for six-to-nine-year-olds. It runs here:
https://osalomonh.github.io/chesskids/

**Today** it is a complete game of chess against a bot, on a board built for
small hands. **Next** it becomes a course: a single path of short lessons that
takes a child who has never seen a chessboard to playing and improving on
their own, with the game you can play today sitting at the end of that path.

The repo has a second purpose. It is a working record of how a product like
this gets built with a few narrowly scoped AI agents, hard contracts between
the layers they touch, and an eval harness that grades the agents rather than
the code they produce. If that is what you came for, skip to
[How it is built](#how-it-is-built).

## What you can do today

Open the site, pick a colour, pick an opponent, tap Play.

- **A full game of chess on an 8×8 board.** Castling, en passant, promotion,
  check, checkmate, stalemate and every draw rule. The rules come from
  [chess.js](https://github.com/jhlywa/chess.js) behind a thin wrapper
  (`standard-game.ts`), so the screen only ever speaks this project's own
  vocabulary and never talks to chess.js directly.
- **Three opponents, named for a child rather than as easy, medium and hard.**
  *Sleepy* moves without looking. *Hungry* grabs any piece it can. *Clever*
  looks one move ahead. They live in `bots.ts` and are policies over legal
  moves, not search depths, which is a deliberate choice explained below.
- **Tap to move.** Tap a piece belonging to the side to move, its legal
  destinations light up, tap one. No dragging required, because precision
  dragging is unreliable at this age and behaves differently on a tablet and a
  trackpad. Promotion pops a picker with the four choices.
- **Play as either colour, or let the app choose.** The board turns around
  for black. The bot replies on its own after your move.
- **A styled interface** in the palette and type set out in `design-brief.md`:
  warm and saturated but soft, Baloo 2 for display, and Lexend for anything a
  child has to read. Both fonts are self-hosted in `assets/fonts`. Touch
  targets are sized for six-year-olds. Nothing is timed, nothing is red,
  nothing punishes.

No account, no sign-in, nothing stored. It works the moment the page loads.

## Where it is going

The next phase turns the app from a game into a course for ages six to nine.
The curriculum is already written and validated against its own schema in
`contracts/curriculum.json`: seven tiers, thirty-two units, each unit a few
minutes long.

| Tier | Name | Units | What it teaches |
|---|---|---|---|
| 1 | Meet the board | 10 | Light and dark squares, square names, how each of the six pieces moves, taking, and promotion. |
| 2 | Playing a real game | 6 | Check and the three ways out of it, checkmate, stalemate, castling, then a first whole game against a very gentle opponent. |
| 3 | Don't give it away | 4 | What each piece is worth, whether a piece is defended, good and bad trades, and how to start a game. |
| 4 | Tricks and traps | 4 | Forks, pins, skewers and discovered attacks. |
| 5 | Finishing the game | 4 | Two-rook mate, back-rank mate, king and queen mate, and thinking two moves ahead. |
| 6 | The last few pieces | 2 | Can the king catch the pawn, and kings facing off. |
| 7 | Play and improve | 2 | Rated games against bots matched to your level, and a coach that walks through your own game. |

**The shape of it** is settled, and comes from `design-brief.md`:

- **One linear path is the home screen.** The child sees where they are, what
  is next, and nothing else. There is no menu.
- **A lesson is three to six micro-challenges**, one screen each, each asking
  for exactly one thing, followed by a short celebration. Six activity types
  are defined in the curriculum schema: a guided demo, a quiz, target
  practice, a mini game, a puzzle set, and a game against a bot.
- **Early lessons use small boards.** Much of tier one is target practice on
  a 5×5 board, because one knight and a handful of stars is a better first
  lesson than sixty-four squares and thirty-two pieces. This is why the
  project has its own board-size-agnostic move generator and game layer
  (`moves.ts`, `game.ts`) alongside chess.js: chess.js cannot go below 8×8.
- **The bots are the assessment, and are never labelled as one.** Every so
  often the path offers a game instead of a lesson. Each bot has a single,
  named, consistent flaw that is exactly the skill the preceding lessons
  taught, and that a seven-year-old can notice and exploit. The three you can
  play today are the first of that cast; the planned roster in
  `contracts/readme.md` adds a bot that never makes room for its king on the
  back rank and one that pushes pawns and never develops.
- **Soft fail states, always.** No lives, no streaks that punish, no timers,
  no leaderboards, no red. A wrong answer gets information, not sympathy.
- **Works without an account** for at least the first lesson. Progress will
  later be saved locally first and synced in the background, so every unit is
  completable offline.

**The order of work** from here, roughly:

1. Wire the path and the first activity type (`target_practice`) onto the
   existing board, so tier one is playable end to end.
2. Write the remaining named-flaw bots and the `bots.json` contract.
3. The remaining activity types, then tiers two through seven.
4. Puzzles from the Lichess CC0 corpus, filtered and imported by an ETL that
   drops anything linking back to a public adult profile.
5. Accounts and saved progress, on the schema already drafted in
   `contracts/schema.sql`. The child is not a data subject: no email, last
   name, birthday, photo, free text or device id is ever stored about them.

## What does not work yet

This is early, and pretending otherwise would defeat the purpose of publishing
it.

- **No lessons on screen.** The curriculum is a validated data file that
  nothing consumes yet. The only thing you can do is play a game.
- **The small-board engine stops at check.** `moves.ts` and `game.ts` generate
  moves for all six pieces, keep turn order, and detect check, checkmate,
  stalemate and repetition, but do not do castling, en passant or promotion.
  Those live only on the 8×8 path through chess.js. That is fine for the
  lessons the small boards serve and will need revisiting if a small-board
  lesson ever wants them.
- **No accounts, no saved progress.** Close the tab and the game is gone.
- **The interface is tuned for beginner readers.** The design brief targets
  the six-to-eight bracket specifically, because children react badly to
  content pitched even a grade off. Nine-year-olds are served by the later
  tiers, not by a different interface.
- **One known curriculum bug.** The first unit teaches that the bottom-right
  square is always light. That is true on 8×8 and false on the 5×5 boards
  other tier-one activities use. It will surface the first time tier one
  renders on a small board.

## Third-party code

The 8×8 rules engine is **chess.js** v1.4.0 by Jeff Hlywa, used under the
BSD-2-Clause licence. Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com). All
rights reserved. Redistribution and use in source and binary forms, with or
without modification, are permitted provided that the copyright notice, the
licence conditions and the disclaimer are retained; the full text ships in
`node_modules/chess.js/LICENSE` and stays in the header of the vendored bundle
that `npm run build` copies to `vendor/chess.js` for the browser.

`moves.ts` and `game.ts` are not replaced by it. They remain the engine for
variable-size lesson boards, where chess.js cannot go.

## How it is built

Four agents live in `.claude/agents/`. Each one owns a slice of the product
and is told, in writing, what it may not touch.

| Agent | Owns | Cannot touch |
|---|---|---|
| `move-logic` | `moves.ts` | contracts, the renderer, the reference test suite's expectations |
| `game-flow` | `game.ts` | `moves.ts`, contracts, anything above it |
| `board-render` | `board.html` | `moves.ts`, contracts |
| `visual-design` | `styles.css`, assets | behaviour of any kind: no handlers, no game logic, no change to what a tap does; contracts |

The scoping is the point. An agent with access to everything will fix your
failing test by editing the test.

**Contracts live in `contracts/`.** `board-state.md` defines the move
generation ↔ rendering interface. `game-state.md` defines game state and what
`applyMove` promises. `curriculum.schema.json` and `curriculum.json` define
what a lesson is. `schema.sql` defines what gets stored, and
`design-tokens.json` is the only place a colour, a size or a duration may
come from. They are owned by a human, they are read-only to every agent, and
an agent that needs one changed writes a proposal into `proposals/` and
stops, rather than editing the contract or working around it. The first such
proposal is there now: an amendment to `game-state.md` to describe the 8×8
path, drafted by the agent that built it and awaiting review.

This has already paid for itself. A contract gap, where `Piece` carried no
type so a renderer could not know which move function to call, stopped a task
before either agent ran. The fix went contract first, then implementation,
then the consumer. That ordering is cheap on paper and expensive to discover
in a merge.

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
access to the repo was not a trade worth making. That is a decision, not a
todo.

**Tests.** Six suites, and every one of them turns `npm test` red on failure.
Agent-written tests live in their own file so a regression can be attributed
to a person or an agent.

## The layer stack

Each layer knows only about the one below it. Nothing reaches up.

| Layer | State |
|---|---|
| Accounts, saved progress | schema drafted, not started |
| Curriculum and activities | curriculum written and validated, nothing consumes it |
| Rendering (`board.html`) | setup screen, game screen, promotion picker; draws the board, turns taps into moves, asks a bot to reply |
| Visual layer (`styles.css`) | palette, type and spacing from the design brief and tokens |
| Bots (`bots.ts`) | three levels over the 8×8 game: random, greedy, two-ply minimax |
| 8×8 game (`standard-game.ts`) | thin wrapper over chess.js in this project's vocabulary |
| Game state (`game.ts`) | small-board lessons: turn order, move application, repetition history |
| Move generation (`moves.ts`) | six pieces, pure, board-size agnostic |

The renderer never calls chess.js directly. It asks `standard-game.ts` for
`legalMovesFrom` and `applyMove`, and it reads status from `gameStatus`. The
wrapper is the only file that imports chess.js. On the lesson path the same
discipline holds one layer down: the renderer asks `game.ts`, `game.ts` asks
`moves.ts`, and if a knight offset ever appears in `game.ts`, something has
gone wrong.

## Running it

```
npm install
npm run check      # typecheck, must exit clean
npm test           # every suite
npm run build      # compile to ESM for the browser and vendor chess.js
npm run serve      # python -m http.server 8000
```

Then open http://localhost:8000/board.html

You need the server. ES modules do not load over `file://`, and the browser
gives you a CORS error rather than anything useful about why.

Compiled JavaScript is not committed. CI typechecks, tests, builds, assembles
`dist/`, and publishes to GitHub Pages, and the deploy step runs only if the
gates pass first.

## Further reading

- `design-brief.md` — the audience, the reference stack, the locked design
  decisions, and what is deliberately left open.
- `contracts/readme.md` — who owns which contract and the rules no agent may
  negotiate, including the case for named-flaw bots over a weakened engine.
- `contracts/curriculum.json` — the full seven-tier ladder.
- `proposals/` — contract amendments drafted by agents and awaiting a human.
