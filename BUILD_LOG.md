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