import { pawnMoves ,Square, Board } from "./moves";

const board: Board = { size: 8, occupied: [] };

console.log("corner:", pawnMoves({ file: 0, rank: 0 }, board, "white"));
console.log("center:", pawnMoves({ file: 4, rank: 4 }, board, "white"));
