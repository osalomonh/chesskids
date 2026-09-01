import { knightMoves ,Square, Board } from "./moves";

const board: Board = { size: 8, occupied: [] };

console.log("corner:", knightMoves({ file: 0, rank: 0 }, board));
console.log("center:", knightMoves({ file: 4, rank: 4 }, board));
