# chesskids — project status

Last updated: 2 September 2026

A chess learning web app for ages 6–9. The app is the vehicle; the actual goal
is learning to design, deploy, and maintain AI agents, with a public artifact
at the end that demonstrates it.

**Two deliverables:**
1. A live URL anyone can click
2. A repo showing the agent engineering — definitions, contracts, evals, and a
   build log including the failures

---

## Where we are

**Phase 0 — hand-building, no agents.** In progress.

The rule for this phase: write everything yourself. You cannot review an
agent's code in a domain where you've never written the code. Phase 0 buys the
calibration that makes every later phase possible.

---

## The layer stack

Each layer only knows about the one below it. We build bottom-up.

| Layer | Status |
|---|---|
| Deployed web app | not started |
| Accounts and saved progress | not started |
| Curriculum | `curriculum.json` written |
| Activities | not started |
| Board rendering | not started |
| **Chess logic** | **in progress ← you are here** |

---

## Done

**Environment**
- Node.js v24.20.0, npm working (needed a PowerShell execution policy change)
- VS Code
- Git installed, repo initialised, `.gitignore` excluding `node_modules`
- GitHub account, repo private for now
- TypeScript + tsx installed, toolchain proven with `hello.ts`

**Contracts** (`/contracts`)
- `curriculum.schema.json` — the format a lesson unit must follow
- `curriculum.json` — the 6–9 ladder, tier 1 fully specified
- `schema.sql` — database shape with row-level security
- `README.md` — ownership rules for the contract layer

**Chess logic** (`moves.ts`)
- `Square` and `Board` types
- `kingMoves` — 8 offsets, boundary-checked
- `knightMoves` — 8 offsets, boundary-checked
- `rookMoves` — 4 directions, walks until edge or blocked

---

## Phase 0 — remaining

1. **`bishopMoves`** — `rookMoves` with diagonal directions:
   `[[1,1],[1,-1],[-1,1],[-1,-1]]`
2. **`queenMoves`** — `rookMoves` with all eight directions
3. **`pawnMoves`** — the awkward one. Moves forward one, captures diagonally,
   two squares on its first move, promotes at the far rank. Needs a colour
   input, which none of the others do.
4. **Refactor to two generic helpers:**
   - `jumpMoves(from, offsets, board)` — king, knight
   - `slideMoves(from, directions, board)` — rook, bishop, queen
   - `pawnMoves` stays special
5. **Write three uncertain decisions in `BUILD_LOG.md`.** These become the
   review checklist for Phase 1.

**Phase 0 is done when** all six pieces work, the duplication is gone, and you
can explain every line of your own code.

---

## Phase 1 — first agent

The point of this phase is scoping and verification, not productivity.

1. **Install Claude Code** into VS Code. Not before Phase 0 is finished.

2. **Write one agent definition.** One narrow job: move generation. Scoped
   tools, a stated spec, no access to anything outside `moves.ts`. This file is
   the artifact, not the code it produces.

3. **First task — a known answer.** Have it write `bishopMoves` and
   `queenMoves` against the `rookMoves` signature. You already know what
   correct looks like, so you can grade it instantly. That's the whole reason
   this is the first task.

4. **Review every line.** Specifically check the two bugs you hit yourself:
   is the push inside the inner loop, and is it before the stepping?

5. **Log the run.** What the spec said, what came back, what surprised you,
   what you changed. Every run gets an entry.

6. **Break it on purpose.** Re-run with a deliberately vague spec — "add the
   remaining sliding pieces" with no signature. Compare the output. This is how
   you learn what a spec is actually doing.

7. **Second task — no known answer.** The refactor to `jumpMoves` and
   `slideMoves`. Harder to verify, which is the point.

**Phase 1 is done when** you can predict the agent's failure before you run it.

---

## Later phases

**Phase 2 — two agents across a contract boundary.** Move-generation agent and
a board-rendering agent. Let them disagree about the interface. The contract
only makes sense once you've felt the failure it prevents.

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
| Custom flawed bots, not weakened Stockfish | Weakened engines blunder randomly. Bots with consistent, named flaws teach something exploitable. |
| Lichess CC0 puzzle corpus | 6M+ rated, theme-tagged puzzles, free for commercial use. Don't hand-author tactics. |
| No accounts until Phase 4 | Collecting nothing means zero COPPA exposure through Phase 3. |

---

## Commands

```
npx tsx test.ts          run a file
npx tsc --noEmit         type-check without producing output
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
- Whether the repo goes public at the end of Phase 0 or Phase 1
