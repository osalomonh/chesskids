# chesskids — project status

Last updated: 3 September 2026

A chess learning web app for ages 6–9. The app is the vehicle; the actual goal
is learning to design, deploy, and maintain AI agents, with a public artifact
at the end that demonstrates it.

**Two deliverables:**
1. A live URL anyone can click
2. A repo showing the agent engineering — definitions, contracts, evals, and a
   build log including the failures

---

## Where we are

**Phase 2 — two agents across a contract boundary.** In progress.

Phase 0 (hand-building) and Phase 1 (one narrow agent) are done. The rule for
this phase: a second agent owns rendering, the move-logic agent owns rules, and
neither reads the other's files. The contract between them is the artifact.

The contract layer exists at `contracts/`, including `board-state.md` — the
interface between move generation and rendering. Two agents now work across it:
move-logic owns `moves.ts`, board-render owns `board.html`, and neither reads
the other's files. The boundary has already stopped one task and forced a
deliberate contract change rather than a workaround. See `BUILD_LOG.md`, 3 Sep.

---

## The layer stack

Each layer only knows about the one below it. We build bottom-up.

| Layer | Status |
|---|---|
| Deployed web app | not started |
| Accounts and saved progress | not started |
| Curriculum | written — 7 tiers, 32 units, conforms to its schema |
| Activities | not started |
| **Board rendering** | **`board.html` draws a board and highlights moves ← you are here** |
| Chess logic | move generation complete, with colour, captures, and piece type |

---

## Done

**Environment**
- Node.js v24.20.0, npm working (needed a PowerShell execution policy change)
- VS Code
- Git installed, repo initialised, `.gitignore` excluding `node_modules`
- GitHub account, repo private for now
- TypeScript + tsx installed, toolchain proven with `hello.ts`

**Chess logic** (`moves.ts`)
- `Square`, `Color`, `Piece`, `Board` types. `Board` is `{ size, pieces }`;
  a `Piece` is `{ square, color }`
- `kingMoves`, `knightMoves` — offset-based, via `jumpMoves`
- `rookMoves`, `bishopMoves`, `queenMoves` — direction-based, via `slideMoves`
- `pawnMoves` — forward one, two from the start rank, diagonal capture
- Captures and friendly blocking across all six. Non-pawn functions read the
  mover's colour from the piece standing on `from`; `pawnMoves` uses its own
  `color` argument

**Tests**
- `test.ts` — 25 passing, the hand-written reference suite
- `test-generated.ts` — 29 passing, agent-written, friendly-blocked and
  enemy-capturable for all six pieces

---

**Contracts** (`/contracts`) — written, reviewed, validated.
- `curriculum.schema.json` — the format a lesson unit must follow. Defines
  `unit`, `mastery`, and six activity types
- `curriculum.json` — the 6–9 ladder. 7 tiers, 32 units (10 / 6 / 4 / 4 / 4 /
  2 / 2). Every unit has all required fields, ids are unique, tier refs resolve
- `schema.sql` — Postgres shape with row-level security, COPPA-minimal child
  records, and a filtered Lichess puzzle corpus
- `readme.md` — ownership rules. Five contracts named, four written
- `board-state.md` — the move-generation ↔ rendering interface. Types,
  coordinates, what the six functions promise, and four known gaps (one now
  resolved)

**Board rendering** (`board.html`)
- Self-contained page, no framework and no npm packages. Draws a board from a
  `Board` object, sized from `board.size`
- Click a piece to highlight its legal destinations; click again to deselect
- Selection and highlight are screen state and never touch the `Board` object
- Currently a 5×5 board with one white knight. Highlighting only — clicking a
  destination does not move the piece yet
- Build: `npx tsc moves.ts --module es2020 --target es2020`. Serve:
  `python -m http.server 8000`. ES modules will not load over `file://`

---

## Open

1. **Gaps 2, 3, and 4 in `board-state.md`.** Gap 2 is now sharper: `pawnMoves`
   still takes a `color` argument that is redundant twice over, since `Piece`
   carries both colour and type. Gap 3 — a move function called on an empty
   square returns moves for a piece that isn't there — is sidestepped by the
   renderer, not resolved.
2. **`t1-u01-light-and-dark` teaches that the bottom-right square is always
   light.** True on 8×8, false on the 5×5 boards `board-state.md` says tier 1
   uses. The unit's own FEN is 8×8, so nothing is broken today. It will surface
   the first time tier 1 renders on the board it claims to use.
3. **Clicking a highlighted square does not move the piece.** Highlighting was
   the whole ask; moving is the next task.
4. **`tokens.json` and `bots.json`** are named as contracts in the readme's
   ownership table but do not exist yet.

---

## Phase 0 — complete

All six pieces work, the duplication is gone, and every line was hand-written
before an agent touched the file. `bishopMoves`, `queenMoves`, and `pawnMoves`
were written by hand, then collapsed into `jumpMoves` and `slideMoves`.
Uncertain decisions are logged in `BUILD_LOG.md`.

---

## Phase 1 — complete

One agent definition, one run, verified independently. See `BUILD_LOG.md`,
3 Sep 2026.

Done:
- `.claude/agents/move-logic.md` — one narrow job, scoped to `moves.ts` and
  `test-generated.ts`, with `test.ts` requiring a stated reason to touch. This
  file is the artifact, not the code it produced.
- The colour and capture task. Reviewed line by line, tests re-run rather than
  taken on report, non-obvious expected counts re-derived by hand.
- The run is logged: spec, the gap the spec didn't cover, what changed, what
  surprised.

Not done, and worth carrying forward:
- **Break it on purpose.** The vague-spec re-run never happened. The scoping
  question it answers — what is the spec actually doing — is still open, and is
  cheaper to answer now than during Phase 2's two-agent handoff.
- The "known answer" first task landed differently than planned: `bishopMoves`
  and `queenMoves` were hand-written in Phase 0, so the agent's first task was
  the colour change instead. Graded against the existing suite rather than
  against a pre-known answer.

**Phase 1's bar** — predicting the agent's failure before running it — was
partly met. The missing colour argument on the five non-pawn signatures was
caught before delegating. The `test.ts` migration was anticipated. The
colourless-mover fallback was not; it surfaced while writing the spec.

---

## Phase 2 — two agents across a contract boundary

Move-generation agent and a board-rendering agent. Let them disagree about the
interface. The contract only makes sense once you've felt the failure it
prevents.

Done:
- **`contracts/board-state.md`** — types, coordinates, orientation rules, what
  the six move functions promise, and an honest list of known gaps.
- **`.claude/agents/board-render.md`** — the second agent. No access to
  `moves.ts`; consumes the contract, never the implementation.
- **The contract stopped a task before either agent ran.** Known Gap 1 said
  `Piece` had no type and that rendering could not begin until it did. The fix
  went contract first, then `moves.ts`, then the renderer.

Remaining:
1. **Let them disagree on purpose.** Change one side of the interface and see
   which agent notices. So far the contract caught the problem *before* a run;
   the harder test is whether it catches one mid-flight.
2. **Carry over the skipped Phase 1 item** — the deliberately vague spec.

**Phase 2 is done when** a contract change breaks the right agent, loudly, and
you saw it coming.

---

## Later phases

**Phase 3 — the eval harness.** Fixed inputs, known-good outputs, run on every
prompt change. Where tests finally get written. This is the phase that
separates people who use agents from people who maintain them.

**Phase 4 — orchestration.** Parallel agents, handoffs, cost and latency,
where the human approval gates go. The rest of the app gets built here.

**Phase 5 — deliberate decay.** Change a dependency, edit a contract, swap the
model. See what rots and how you'd catch it. This is "maintenance."

---

## Decisions made

| Decision | Reasoning |
|---|---|
| Ages 6–9, not 1–3 | Chess needs abstract rule-following. Age 3 is the floor for pre-chess; 6–9 is where real chess starts. |
| Chess, not an industry history site | Fast verification. Move legality is testable; a paragraph about Fairchild Semiconductor is not. |
| Web first, no app stores | A URL beats a download during a resume screen. Store review adds weeks and zero hiring signal. |
| Project outside OneDrive | OneDrive sync fights npm's high-frequency file operations. |
| `file`/`rank` over `x`/`y` | Matches chess vocabulary, so external chess data needs no translation. |
| Board size as an input, not hardcoded | Tier 1 uses 5×5, real games use 8×8. Same function serves both. |
| One `moves.ts`, not six files | Six 15-line files is over-fragmentation. Split when navigation gets hard, not before. |
| Colour on the piece, not the square | `Board` holds `Piece[]`, each `{ square, color }`. A square doesn't have a colour; the thing standing on it does. |
| Non-pawn moves read colour from the board | Keeping `(from, board)` signatures frozen left no other way to tell friend from foe. Costs an inconsistency with `pawnMoves`, which takes its colour directly. |
| Agent-written tests live in `test-generated.ts` | Keeps the hand-written reference suite in `test.ts` uncontaminated, so a regression can be attributed to a person or an agent. |
| The child is not a data subject | No email, last name, DOB, photo, voice, location, device id, or free text stored about a child. Collecting nothing beats securing something. |
| Unit ids immutable once shipped | Progress rows reference them. Renumbering a unit orphans every child's history. |
| Drop `GameUrl` and `OpeningTags` at Lichess ETL | They link back to public adult profiles. Import FEN, moves, rating, themes, ply only. |
| Custom flawed bots, not weakened Stockfish | Weakened engines blunder randomly. Bots with consistent, named flaws teach something exploitable. |
| Lichess CC0 puzzle corpus | 6M+ rated, theme-tagged puzzles, free for commercial use. Don't hand-author tactics. |
| No accounts until Phase 4 | Collecting nothing means zero COPPA exposure through Phase 3. |

---

## Commands

```
npx tsx test.ts             run the reference suite
npx tsx test-generated.ts   run the agent-written suite
npx tsc --noEmit            type-check without producing output
npm install -D <pkg>     add a dev dependency
git status               what state am I in
git log --oneline        what have I committed
```

---

## Open questions

- Which of the three wedges is the bet: adaptive coach, parent reporting, or a
  narrow beachhead market
- Whether the visual identity work (`tokens.json`) starts in parallel or waits
  for the rendering layer
- Whether the repo goes public. Both candidate moments (end of Phase 0, end of
  Phase 1) have now passed undecided
- ~~Whether `contracts/` gets written before the rendering agent exists~~ —
  answered: written first. Curriculum and storage are specified; the
  move-generation ↔ rendering interface still is not
- Whether `tokens.json` starts now or waits for the rendering layer. The
  README's ownership table already names it as a contract
