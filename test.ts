import { pawnMoves, Board } from "./moves";

const empty: Board = { size: 8, occupied: [] };

console.log("start rank:", pawnMoves({ file: 4, rank: 1 }, empty, "white"));
console.log("mid board: ", pawnMoves({ file: 4, rank: 3 }, empty, "white"));
console.log("black start:", pawnMoves({ file: 4, rank: 6 }, empty, "black"));

const blocked: Board = { size: 8, occupied: [{ file: 4, rank: 2 }] };
console.log("blocked:   ", pawnMoves({ file: 4, rank: 1 }, empty === blocked ? empty : blocked, "white"));

const capture: Board = { size: 8, occupied: [{ file: 1, rank: 4 }] };
console.log("capture:   ", pawnMoves({ file: 0, rank: 3 }, capture, "white"));