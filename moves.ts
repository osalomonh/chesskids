//logic defining the moves of chess pieces on a board 

//types
export type Square = { file: number; rank: number };
export type Board = { size: number; occupied: Square[] };

//constants
const KING_OFFSETS = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
const KNIGHT_OFFSETS = [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]];
const ROOK_DIRECTIONS = [[0,1], [1,0], [0,-1], [-1,0]];
const BISHOP_DIRECTIONS = [[1,1], [1,-1], [-1,1], [-1,-1]];
const QUEEN_DIRECTIONS = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

//helpers
const isOccupied = (board: Board, file: number, rank: number) =>
  board.occupied.some(sq => sq.file === file && sq.rank === rank);
const onBoard = (board: Board, file: number, rank: number) =>
  file >= 0 && file < board.size && rank >= 0 && rank < board.size;

//functions
function jumpMoves(from: Square, offsets: number[][], board: Board): Square[] {
  const results: Square[] = [];

  for (const offset of offsets) {
    const newFile = from.file + offset[0];
    const newRank = from.rank + offset[1];

    if (onBoard(board, newFile, newRank)) {
      results.push({ file: newFile, rank: newRank });
    }
  }

  return results;
}
function slideMoves(from: Square, directions: number[][], board: Board): Square[] {
  const results: Square[] = [];

  for (const direction of directions) {
    let file = from.file + direction[0];
    let rank = from.rank + direction[1];

    while (onBoard(board, file, rank)) {
      // Check if the square is occupied
      if (isOccupied(board, file, rank)) {
        break; // Stop if the square is occupied
      }
      results.push({ file, rank});
      file += direction[0];
      rank += direction[1];
    } 
  }
  return results;
}

//piece move calls
export function kingMoves (from: Square, board: Board): Square[] { 
   return jumpMoves(from, KING_OFFSETS, board);
}

export function knightMoves (from: Square, board: Board): Square[] {
    return jumpMoves(from, KNIGHT_OFFSETS, board);
}

export function rookMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, ROOK_DIRECTIONS, board);
}

export function bishopMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, BISHOP_DIRECTIONS, board);
}

export function queenMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, QUEEN_DIRECTIONS, board);
}

export function pawnMoves(
  from: Square,
  board: Board,
  color: "white" | "black"
): Square[] {
 
  const direction = color === "white" ? 1 : -1;
  const startRank = color === "white" ? 1 : board.size - 2;
  const results: Square[] = [];

  const oneAhead = from.rank + direction;

  if (onBoard(board, from.file, oneAhead) && !isOccupied(board, from.file, oneAhead)) {
    results.push({ file: from.file, rank: oneAhead });

    const twoAhead = from.rank + direction * 2;

    if (from.rank === startRank && !isOccupied(board, from.file, twoAhead)) {
      results.push({ file: from.file, rank: twoAhead });
    }
  }

  for (const sideStep of [-1, 1]) {
    const captureFile = from.file + sideStep;

    if (onBoard(board, captureFile, oneAhead) && isOccupied(board, captureFile, oneAhead)) {
      results.push({ file: captureFile, rank: oneAhead });
    }
  }

  return results;
}