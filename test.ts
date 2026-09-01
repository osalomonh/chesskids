import { rookMoves ,Square, Board } from "./moves";

const board: Board = { size: 8, occupied: [] };

console.log("corner:", rookMoves({ file: 0, rank: 0 }, board));
console.log("center:", rookMoves({ file: 4, rank: 4 }, board));
