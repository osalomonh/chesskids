# Build log

## 2 Sep 2026 — Phase 0 complete

All six piece move generators working, 24 tests passing.

**Refactor.** Collapsed five near-identical functions into `jumpMoves` and
`slideMoves`. King and knight differed only by their offsets array; rook,
bishop, and queen only by directions. Went from ~130 lines to ~40. Ran the
same tests before and after and confirmed identical counts.

**Bug: knight offsets.** Wrote eight offsets but the last four duplicated the
first four. Centre knight returned 8 results, which is the correct *count*,
so it looked right. It was four squares listed twice, with the "1 first"
moves entirely missing. Lesson: counting the output isn't checking it.

**Bug: unsaved file.** Every pawn test returned an empty array. Spent an hour
adding debug output before realising `moves.ts` wasn't saved — tsx reads
disk, not the editor. Check the tab for an unsaved dot first from now on.

**PowerShell execution policy.** npm wouldn't run on Windows; PowerShell
blocks scripts by default. Fixed with `Set-ExecutionPolicy -Scope CurrentUser
-ExecutionPolicy RemoteSigned`. The confirmation prompt didn't appear, so
typing Y produced a second confusing error. Verified with
`Get-ExecutionPolicy -Scope CurrentUser`.

**Decisions.**
- `file`/`rank` over `x`/`y` — matches chess vocabulary, so external chess
  data needs no translation.
- Board size as a parameter, not hardcoded — tier 1 uses 5×5, real games 8×8.
- All occupied squares block; captures not yet distinguished. `occupied` has
  no colour. This is the first Phase 1 agent task.
- No en passant or promotion. En passant needs move history in `Board`;
  promotion needs a richer return type than `Square[]`. Both are data model
  limitations, not missing logic.

## 3 Sep 2026 — Phase 1, first agent run

Commit `7a2de93`. The `move-logic` agent (Sonnet; Read, Edit, Bash, Grep) took
the colour task that Phase 0 left queued.

**The spec.** Give pieces a colour. Replace `occupied: Square[]` with a list of
pieces carrying a square and a colour. Captures allowed, friendly pieces block,
pawn diagonals require an enemy specifically. Keep every exported signature.
New tests in `test-generated.ts`.

**The gap the spec didn't cover.** `kingMoves`, `knightMoves`, `rookMoves`,
`bishopMoves`, and `queenMoves` take `(from, board)` and no colour. "Keep every
exported signature" and "know friend from foe" can only both hold if the
function derives the mover's colour from the board — by looking up whatever
piece stands on `from`. That wasn't in the task; it fell out of it. Caught
before delegating, not after.

**Decision: the colourless mover.** If no piece stands on `from`, the mover has
no colour and every piece counts as an enemy. This is what keeps the nine
`test.ts` cases that ask for moves from an empty square working. It is also a
sharp edge: a caller who forgets to put the moving piece on the board silently
gets capture-everything behaviour instead of an error.

**`test.ts` had to change.** It built `{ size: 8, occupied: [...] }` in six
places and no longer compiled. Migrated to `pieces`, with the intent of each
case preserved: the rook and pawn "blocked" cases got *friendly* blockers, the
pawn "capture" piece became black. No expected number was edited — 9, 0, 1, and
2 all still hold, which is the check that the migration didn't quietly move the
goalposts.

**Counting still isn't checking.** Same lesson as the knight offsets, second
time around. The agent reported 29 new tests passing; the counts it invented
for the queen cases (25 blocked, 26 capturable) were re-derived by hand before
being believed — 27 unblocked, a friendly blocker two squares out removes 2, an
enemy removes 1. They held. The habit is the point, not the outcome.

**Verified independently of the agent's report.** `npx tsx test.ts` 25/25,
`npx tsx test-generated.ts` 29/29, `npx tsc --noEmit --strict` clean.

**What the agent definition got right.** Scoping it to `moves.ts` plus
`test-generated.ts`, with `test.ts` needing an explicit reason to touch, is what
surfaced the migration as a decision to report rather than a silent edit.

**Decisions.**
- Colour lives on the piece, not the square. `Board` is now
  `{ size, pieces: Piece[] }`; `Piece` is `{ square, color }`.
- Non-pawn functions read colour from the board; `pawnMoves` keeps using its own
  `color` argument. Two different mechanisms for the same fact, forced by the
  signature freeze. Revisit if it causes a bug.
- `contracts/` is referenced by `CLAUDE.md` and `PROJECT_STATUS.md` but has
  never existed in the repo. Not created here — it belongs to Phase 2.

## 3 Sep 2026 — the contract layer arrives

Four files staged: a curriculum, a JSON Schema for it, a Postgres schema, and
an ownership README. This is the Phase 2 blocker cleared, and it is a
substantial drop — 32 units across 7 tiers, 253 lines of SQL.

**Reviewed, and it holds up.** The curriculum parses, and it conforms to its
own schema: all 32 units carry every required field (`id`, `tier`, `order`,
`title`, `concept`, `estimatedMinutes`, `activities`, `mastery`), no duplicate
unit ids, no unit pointing at a tier that doesn't exist, and all six activity
types in use (`guided_demo`, `quiz`, `target_practice`, `mini_game`,
`puzzle_set`, `bot_game`) are defined in `$defs`. Unit counts per tier:
10 / 6 / 4 / 4 / 4 / 2 / 2. Checked by walking the schema, not by opening the
file and nodding at it.

**Four intake defects, none in the content.** All four are about the packaging:

1. **The directory is `.calude/contracts/`.** Typo for `.claude`. It also
   shouldn't live under a tooling directory at all — `CLAUDE.md` and the
   README's own `# /contracts` heading both put it at the repo root.
2. **Two files have each other's contents.** `curriculum.schema` holds the
   SQL; `schema` holds the JSON Schema. Both files are individually fine.
   Reading either one by its name tells you the wrong thing.
3. **No extensions.** `curriculum` should be `curriculum.json`, and the
   README is `readMe.md` where every doc refers to `README.md`.
4. **Nothing was committed.** The files are staged; `HEAD` is still `7a2de93`,
   the colour commit. `BUILD_LOG.md` and `PROJECT_STATUS.md` were also sitting
   modified and unstaged.

Lesson, and it rhymes with the unsaved-file hour on 2 Sep: `git add` is not
`git commit`, and a staged file looks exactly like a committed one in the
editor. `git log --oneline -1` answers in a second what the file tree can't.

**Fixed same day: 1, 2, and 3.** Two passes. The first moved the files to
`.claude/contracts/` with the extensions on and the swap undone; the second
moved them again to `contracts/` at the repo root, which is what `CLAUDE.md`,
the readme's `# /contracts` heading, and the `$id` in `curriculum.schema.json`
had all been saying from the start. Four sources of truth now agree on one
path.

Re-validated after each move rather than once at the end: 7 tiers, 32 units,
zero missing required fields, zero duplicate ids, zero unresolved tier refs,
six activity types against six `$defs`, 8 tables and 8 RLS policies. Swap
confirmed by byte count and first line, not by filename — `curriculum.schema.json`
is 9,614 bytes opening on `$schema`, `schema.sql` is 9,616 opening on a SQL
comment, the same sizes they had under the wrong names. Nothing was corrupted
in transit, and no stray `.calude/` or `.claude/contracts/` is left on disk.

**Defect 4 got worse before it got better.** Moving the files without telling
git left the index describing a repo that no longer exists: the four
`.calude/contracts/*` paths are still staged as additions while deleted from
the worktree (`AD`), and the real `.claude/contracts/` is untracked. A plain
`git commit` here would have committed four files at the typo'd path, none of
them on disk, and omitted the actual contracts entirely. `git add -A` stages
the deletions and the additions together; because the typo'd paths were never
in a commit, they vanish from the index rather than entering history.

Second lesson, same family as the first: `git status` was showing this the
whole time. `AD` and `??` on adjacent lines is the shape of a rename git
wasn't told about.

**The swap is the interesting one.** A contract nobody can locate by name is
worse than a missing contract, because the missing one fails loudly. This is
the Phase 2 failure mode arriving before the second agent does — an agent told
to "read `schema.sql`" would have found JSON Schema and either crashed or,
worse, adapted.

**Decisions encoded in the contracts, worth surfacing here.**
- Five contracts named, four written. `tokens.json` and `bots.json` are
  declared in the README's ownership table but do not exist yet. The README's
  own order-of-work lists `bots.json` as next.
- The child is not a data subject. No email, last name, DOB, photo, voice,
  location, device id, or free-typed text of any kind is stored about a child.
- Unit ids are immutable once shipped — progress rows reference them.
- Bots are policies over legal moves with named flaws (`sleepy-sam`,
  `greedy-gordon`, `rusher-rita`, `back-rank-bob`), not weakened Stockfish.
  This is the decision the README argues hardest for.
- Lichess ETL drops `GameUrl` and `OpeningTags` — they link to public adult
  profiles. Import FEN, moves, rating, themes, ply; approve rating ≤ 1200,
  ply ≤ 3, popularity ≥ 80.

**Settled: contracts live at the repo root.** Not under `.claude/`, which is
Claude Code's config directory and holds `agents/`. Product contracts and agent
config are different things with different owners, and the move-logic agent's
"`contracts/` is read-only" rule now resolves to a real path instead of
nothing. Worth noting the cost of getting there: the files moved twice, and
each move invalidated the docs describing them.

**Still not written down anywhere:** the board-state contract between move
generation and rendering. `Board` and `Piece` remain de facto interfaces living
in `moves.ts`. That is the one contract Phase 2 actually needs, and none of the
four files address it.

## 3 Sep 2026 — Phase 2, the contract stops something

`contracts/board-state.md` written, then immediately earned its keep.

**The boundary held before either agent ran.** The task was: board-render
builds `board.html`, drawing a 5×5 board with one white knight and highlighting
its legal destinations on click. The contract's own Known Gap 1 said `Piece`
has no type, that a renderer therefore cannot know what to draw or which move
function to call, and that this "is the first thing that must be resolved
before rendering." Written twenty minutes before the task that needed it.

So the task was blocked on a decision only the project lead could make, and the
gap was found by reading the contract rather than by an agent failing halfway
through. That is the whole argument for writing the thing down.

**Resolution.** `Piece` gains a required `type`:

```ts
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
type Piece     = { square: Square; color: Color; type: PieceType };
```

Contract updated first, then `moves.ts`, then the renderer. That order matters:
the contract is the thing both sides read, so it cannot be the thing that
lags. Gap 1 is marked resolved in place rather than deleted — the reasoning is
worth more than the tidiness.

**Dispatch stays in the consumer.** `moves.ts` still exports six functions and
does not choose between them. The renderer writes the `switch` from `type` to
function. Noted in the contract: if a second consumer writes the same switch,
that is the signal to add a dispatcher — and that would be another contract
change, not a convenience someone slips in.

**Two agent runs, both clean.**

*move-logic* added the type and migrated roughly twenty piece fixtures across
both suites, typing each mover to match the function under test and defaulting
blockers to `"pawn"`. The `moves.ts` diff is two lines. Verified independently:
25/25, 29/29, `tsc --strict` clean, and the diff confirmed to touch no function
body.

*board-render* built `board.html` without needing anything the contract didn't
give it. It kept selection and highlight state out of the `Board` object, called
a move function only for squares confirmed to hold a piece, and special-cased
the pawn's third argument. No parallel piece list, no chess rules in the
renderer.

**Verified, and what that word covers.** The knight's eight destinations were
computed from the *compiled* `moves.js`, not the TypeScript —
`(0,1) (0,3) (1,0) (1,4) (3,0) (3,4) (4,1) (4,3)` — and `board` came back
unmutated. Both files were served over HTTP and checked for status and MIME
type, because a wrong content type makes a browser refuse a module in silence.
None of that is evidence the page looks right. Nobody has seen it yet, and the
agent was explicitly told not to claim otherwise.

**The gotchas worth keeping.**
- `package.json` was `"type": "commonjs"`, so a bare `tsc` emitted CommonJS and
  a browser `import` failed. The compile has to say `--module es2020`. Later
  the same day this became `npm run build`, after the raw command broke twice
  — see the entry below.
- ES modules do not load over `file://`. The page needs a server —
  `python -m http.server 8000` — or it silently does nothing.
- `moves.js` is now gitignored. It is build output that goes stale the moment
  `moves.ts` changes, and a stale compiled copy in history is a debugging trap.

**Found on the way past: the 5×5 board's bottom-right square is dark.** The
colouring is correct for 8×8, where h1 is light, and an odd-sized board simply
cannot match that convention at both corners. But curriculum unit
`t1-u01-light-and-dark` teaches "the bottom right corner is always light", and
`board-state.md` says tier 1 uses 5×5 boards. The unit's own FEN is 8×8, so
nothing is broken today — but the lesson and the board size disagree, and that
will surface the first time tier 1 is rendered on the board it claims to use.

**Open.** Clicking a highlighted square does not move the piece; only
highlighting was asked for. Gaps 2, 3, and 4 in `board-state.md` remain open,
and gap 2 is now sharper — `pawnMoves` still takes a `color` argument that is
redundant twice over, since the piece carries both colour and type.

## 3 Sep 2026 — a tsconfig, and the commands become scripts

`tsconfig.json` added, with `@types/node` and npm scripts. Three consequences,
two of them unwanted.

**`noUncheckedIndexedAccess` made `moves.ts` fail typechecking.** Six
`TS2532: Object is possibly 'undefined'` errors on `offset[0]`, `offset[1]`,
`direction[0]`, `direction[1]`. The flag is not part of `strict`, which is why
the file was clean before and red after. Confirmed the cause by re-running with
`--noUncheckedIndexedAccess false`: zero errors. The code was never wrong —
every entry is a literal pair — TypeScript just could not see that through
`number[][]`.

Fixed with a tuple type rather than assertions:

```ts
type Offset = readonly [number, number];
```

Five constants and two helper parameters annotated `readonly Offset[]`.
Indexing a fixed-length tuple at a literal index is safe under the flag, so no
`!`, no `as`, no `?? 0`. The agent was told explicitly that reaching for an
assertion meant stopping and reporting instead. It didn't need to.

`Offset` is deliberately not exported. `contracts/board-state.md` describes the
module's exported surface, and adding to it would be a contract change.

**The documented build command broke, silently.** Adding `tsconfig.json` made
this fail:

```
$ npx tsc moves.ts --module es2020 --target es2020
error TS5112: tsconfig.json is present but will not be loaded if files are
specified on commandline.
```

That command was written in four committed places. Worse, the first check of
it here reported the emitted JavaScript as byte-identical — which was wrong.
The compile had exited 1 and written nothing, so of course the old file still
hashed the same. A build that fails and leaves a stale artifact behind looks
exactly like a build that succeeded and changed nothing.

Third time this project has been bitten by the same shape: an unsaved file, a
staged-not-committed tree, and now a failed build behind an unchanged
artifact. In all three the tool was reporting accurately and the check was
asking the wrong question. Hash the output *and* check the exit code.

**So the commands became scripts.**

```
npm run build   tsc moves.ts --module es2020 --target es2020 --ignoreConfig
npm run check   tsc --noEmit
npm test        all three suites
```

Four documents now say `npm run build` instead of naming flags. The point is
not brevity: a command written in four places drifts, and three of those four
copies were already wrong.

**`npm test` was a false gate and is now wider.** It ran only `moves.test.ts`
— three assertions — while the 25 in `test.ts` and 29 in `test-generated.ts`
sat outside it. All three are now chained.

But two of the three still cannot fail. `test.ts` and `test-generated.ts` count
passes and print a summary; neither sets a non-zero exit code, so a failing
assertion in either is invisible to `&&` and to CI. Only `moves.test.ts`, which
uses `node:test`, actually fails the gate. This is a known hole, not a fixed
one.

**`hello.ts` deleted.** Intentional — the toolchain-proving file had served its
purpose and `tsconfig.json` was sweeping it into the compilation.

## 3 Sep 2026 — Phase 3, the eval harness

Ten commits, `3960540` through `7342d87`.

**Supersedes the previous entry.** That entry closed by saying `test.ts` and
`test-generated.ts` "still cannot fail" the gate, and that only
`moves.test.ts` sets an exit code. That is no longer true as of `3960540`.
The claim stands in that entry as written; this is the correction.

**Tests moved from counting to comparing.** `moves.test.ts` converted from the
script style to `node:test`, with `assert.deepStrictEqual` against the actual
squares returned rather than a count of them. Three cases: knight in the
corner, knight in the centre, rook in the corner. `test.ts` still counts —
`check(label, actual, expected)` compares `actual.length` to a number — and
that remains a gap.

**`process.exitCode` added to both script suites.** `3960540` appended
`if (failed > 0) process.exitCode = 1;` to `test.ts` and `test-generated.ts`.
Before that, 54 of the 57 assertions could not turn `npm test` red: both
script suites printed a summary and exited 0 regardless, so `&&` chained
straight through a failure. Only the three in `moves.test.ts` failed the gate.

The same commit also duplicated the summary `console.log` in both files, so
each suite printed its result twice; `a22f308` removed the duplicates.

**`tsconfig.json` broke the documented build command.** TypeScript will not
load a config file when files are named on the command line:

```
error TS5112: tsconfig.json is present but will not be loaded if files are
specified on commandline.
```

Resolved with npm scripts, so `npm run check`, `npm test`, and `npm run build`
mean one thing for everyone rather than each caller assembling flags.

**`tsconfig.json` had no `exclude`, so `tsc` swept the eval fixtures into the
compilation.** A fixture is a copy of the pre-task source and contains
deliberately broken code — `evals/01-tuple-types/setup/moves.ts` is the
`number[][]` version and throws the same six `TS2532` errors the tuple type
was written to remove. With no `exclude`, every fixture added would have made
`npm run check` permanently red. Fixed by `"exclude": ["evals", "node_modules"]`.

**Two harness files, with separate jobs.**

`evals/check.ts` is an inspector: it reports what is true and asserts nothing
about how the repo got that way. Four assertions:

- `npm run check` passes
- `npm test` passes
- scope — `git diff --name-only HEAD` contains nothing outside `moves.ts`
- types honest — `tsconfig.json` still contains
  `"noUncheckedIndexedAccess": true`

The fourth exists because the task can be satisfied by disabling the flag that
makes it necessary.

`evals/run.ts` is a conductor: it sequences a run. Refuses without an eval
name, refuses on a missing directory, refuses on a dirty tree, refuses on an
empty `task.md`, copies `setup/moves.ts` over `moves.ts`, invokes
`claude -p` with the task text, runs the checks, and restores `moves.ts` with
`git checkout --` in a `finally`.

Each of the four assertions was deliberately broken and observed to fail
before being trusted.

**The dirty-tree guard moved from `check.ts` to `run.ts`** (`7342d87` removed
it from the inspector; it lives in the conductor). The inspector runs after
the agent has edited `moves.ts`, so the tree is always dirty at that point —
it cannot demand a clean tree when the state it exists to examine is the
dirt.

**First eval ran end to end, manually.** `01-tuple-types`: the fixture was
staged, the agent rebuilt the tuple fix from the pre-fix source, and its
output matched the committed version byte-for-byte apart from a trailing
newline.

**Automated runs are blocked.** `claude -p` is non-interactive, so the Edit
permission prompt raised inside the run has nobody to answer it. The decision
taken was to run evals manually rather than pre-authorise unattended write
access.

**During the blocked run, the main session tried to resume the subagent past
the permission denial with "don't stop and ask me first."** The subagent did
not treat that as authorization and refused. The main session then reported
its own error rather than burying it.

**The eval run polluted git history because `task.md` did not forbid
committing.** Fixed by adding that line to the task.

**`hello.ts`, `moves.js`, and the four-document command references** are
unchanged by this entry; see the entry above.
## 4 Sep 2026 — the 8×8 path moves to chess.js

**Decision: adopt chess.js (v1.4.0, BSD-2-Clause) for full games.** The
variable-board engine was never going to grow castling, en passant and
promotion cheaply, and a playable game needs all three plus draws. chess.js
has had them right for years. It becomes the rules engine for the 8×8 game;
`moves.ts` and `game.ts` are **superseded on the 8×8 path only** and retained,
unchanged, for the variable-size lesson boards where chess.js cannot go.
Nothing was deleted.

**The wrapper is the boundary.** `standard-game.ts` is the only file that
imports chess.js. It exposes the project's own vocabulary — `Square`,
`Color`, `Piece`, `Board`, `Move` from `moves.ts`, plus `StandardMove`,
`StandardGame`, `MoveResult`, `StandardGameStatus` — and nothing from
chess.js leaks through an exported type or value. The renderer and the bots
call the wrapper; if `new Chess(` ever appears in `board.html`, something
has gone wrong. The wrapper is pure: `applyMove` returns a new game and the
input is never mutated. A game is a FEN plus the long-algebraic move history;
every question except repetition is answered from the FEN, and repetition
replays the history so chess.js owns that rule too.

**Contract change proposed, not made.** `contracts/game-state.md` describes
the variable-board game layer and says nothing about a second path. The
amendment is drafted in `proposals/game-state-standard-game.md` for the
project lead to review. `contracts/` was not edited.

**Bots.** `bots.ts` has three levels over the wrapper: `random`, `greedy`
(highest-value capture, else random) and `thinking` (minimax to depth 2 on
material: pawn 1, knight and bishop 3, rook 5, queen 9). `chooseMove(game,
level)` is pure and takes an injectable random source so tests are
deterministic. Tests cover legality at every level, greedy taking a hanging
queen, and thinking declining a one-move blunder.

**Screens.** `board.html` gained a setup screen (colour, opponent, Play) and a
promotion prompt; the bot replies automatically after the player's move. The
three opponents are named for children rather than easy/medium/hard.

**Browser loading.** `tsc` emits `import { Chess } from "chess.js"` verbatim
and a browser cannot resolve a bare specifier, so `board.html` carries an
import map pointing `chess.js` at `vendor/chess.js`, which `npm run build`
copies out of `node_modules`. The vendored bundle is gitignored and keeps its
licence header. The deploy workflow copies `vendor/` and `styles.css` and the
new compiled modules into `dist/`.

**`design-brief.md` was briefly a copy of the visual-design agent file.**
When this work started the brief in the tree was byte-identical to
`.claude/agents/visual-design.md`, with no numbered sections. The real brief
(ten sections) arrived from the parallel design session partway through; the
styling pass was re-checked against it, in particular §7 voice (no
exclamation marks outside genuine celebration) and §8 anti-patterns.
