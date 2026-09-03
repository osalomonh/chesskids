# /contracts

Everything in this directory is a shared interface. It exists because the
failure mode of multi-agent development is agents inventing incompatible
formats and you spending your week reconciling them.

## The rule

| File | Owner | Everyone else |
|---|---|---|
| `curriculum.schema.json` | pedagogy agent + you | read-only |
| `curriculum.json` | pedagogy agent + you | read-only |
| `schema.sql` | backend agent + you | read-only |
| `tokens.json` | UI/UX agent + you | read-only |
| `bots.json` | game-logic agent + you | read-only |

An agent that needs a contract changed opens a proposal. You merge it. No
agent edits a contract it does not own, ever, including "just adding a field".

## Why the contracts are these five things

They are the five places where two agents have to agree or the build breaks:

- **Curriculum** — what a "level" is. The app agent renders it, the game-logic
  agent generates content for it, the backend agent stores progress against it.
- **Schema** — what a row is. Backend writes it, app reads it, marketing
  reports on it.
- **Tokens** — what a colour and a touch target are. UI defines, app consumes,
  web mirrors.
- **Bots** — what an opponent is. Game logic implements, curriculum references.

## Rules that are not negotiable by any agent

1. **Unit ids never change once shipped.** Progress rows reference them.
   Renumbering a unit orphans every child's history.
2. **No child free-text anywhere.** No chat, no custom names beyond a first
   name, no comments, no usernames the child types. This is a COPPA and
   moderation surface, and closing it is far cheaper than moderating it.
3. **No third-party analytics or ad SDK in the client.** First-party events
   into our own Postgres only.
4. **Minimum touch target 60px.** Not 44. Six-year-olds have imprecise motor
   control and often use a parent's phone.
5. **No visible rating that can go down.** Store Glicko, display a level.
6. **LLM output is never streamed live to a child.** Generate server-side,
   store, gate on `safety_status`, then display.
7. **Local-first.** Every unit must be completable offline. Sync is a
   background concern, not a precondition for play.

## Order of work

1. `curriculum.json` tier 1 (done, needs voiceover scripts filled in)
2. `bots.json` (not written yet — see note below)
3. Board renderer + `target_practice` activity type
4. Lichess ETL and the `puzzles` table
5. Supabase and sync
6. Everything else

## On bots

Do not ship Stockfish at low skill levels as the beginner opponent. Weakened
Stockfish blunders randomly and unpredictably, which reads as arbitrary to a
child and teaches nothing exploitable. Build bots with named, consistent
flaws instead:

- `sleepy-sam` — never captures unless the capture is free. Teaches the child
  that hanging a piece has consequences, gently.
- `greedy-gordon` — always takes the most valuable available piece, even into
  a recapture. Teaches counting defenders.
- `rusher-rita` — pushes pawns and ignores development. Teaches opening
  principles by contrast.
- `back-rank-bob` — plays reasonably but never makes luft. Teaches back-rank
  mate.

Each bot is a policy over legal moves, not a search depth. This is the single
most pedagogically valuable thing in the whole build and it is also cheaper to
implement than tuning an engine.