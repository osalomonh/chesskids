# chesskids

A chess learning web app for ages 6–9. TypeScript, no framework yet.

## Structure
- `moves.ts` — pure move generation. No UI imports, ever.
- `test.ts` — hand-written reference suite.
- `test-generated.ts` — agent-written suite.
- `moves.test.ts` — `node:test` suite. The only one that fails the exit code.
- `board.html` — the rendering layer. Loads the compiled `moves.js`.
- `contracts/` — shared interfaces. Read-only unless explicitly asked.

## Commands
- `npm run check` — typecheck. Must exit clean.
- `npm test` — all three suites.
- `npm run build` — compile `moves.ts` to `moves.js` as ESM, for `board.html`.

## Rules
- Pure functions. Everything a function needs arrives as an argument.
- Never hardcode board size. Use `board.size`.
- `file` = column, `rank` = row. Both 0-indexed.
- Run `npm run check` and `npm test` after any change to `moves.ts`. Both must
  pass. Run `npm run build` too if `board.html` needs the change.
- `contracts/board-state.md` — the interface between move generation and
  rendering. Read before touching either side.