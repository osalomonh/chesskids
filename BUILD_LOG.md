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
- `package.json` is `"type": "commonjs"`, so a bare `tsc` emits CommonJS and a
  browser `import` fails. The compile has to say `--module es2020`.
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