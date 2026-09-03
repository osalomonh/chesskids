import { queenMoves ,Square, Board } from "./moves";

const board: Board = { size: 8, occupied: [] };

console.log("corner:", queenMoves({ file: 0, rank: 0 }, board));
console.log("center:", queenMoves({ file: 4, rank: 4 }, board));
