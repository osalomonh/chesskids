# chesskids

A chess learning web app for ages 6–9. TypeScript, no framework yet.

## Structure
- `moves.ts` — pure move generation. No UI imports, ever.
- `test.ts` — manual test script. Run with `npx tsx test.ts`.
- `contracts/` — shared interfaces. Read-only unless explicitly asked.

## Rules
- Pure functions. Everything a function needs arrives as an argument.
- Never hardcode board size. Use `board.size`.
- `file` = column, `rank` = row. Both 0-indexed.
- Run `npx tsx test.ts` after any change to `moves.ts`. All tests must pass.