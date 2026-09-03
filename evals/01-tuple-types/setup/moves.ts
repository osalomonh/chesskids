//logic defining the moves of chess pieces on a board 

//types
export type Square = { file: number; rank: number };
export type Color = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Piece = { square: Square; color: Color; type: PieceType };
export type Board = { size: number; pieces: Piece[] };

//constants
const KING_OFFSETS = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
const KNIGHT_OFFSETS = [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]];
const ROOK_DIRECTIONS = [[0,1], [1,0], [0,-1], [-1,0]];
const BISHOP_DIRECTIONS = [[1,1], [1,-1], [-1,1], [-1,-1]];
const QUEEN_DIRECTIONS = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

//helpers
const pieceAt = (board: Board, file: number, rank: number): Piece | undefined =>
  board.pieces.find(p => p.square.file === file && p.square.rank === rank);
const isOccupied = (board: Board, file: number, rank: number) =>
  pieceAt(board, file, rank) !== undefined;
const onBoard = (board: Board, file: number, rank: number) =>
  file >= 0 && file < board.size && rank >= 0 && rank < board.size;

// Finds the colour of the piece standing at `from`. If no piece stands
// there, the mover has no colour, and every occupied square is treated as
// an enemy (capturable) below.
const moverColor = (board: Board, from: Square): Color | undefined =>
  pieceAt(board, from.file, from.rank)?.color;

//functions
function jumpMoves(from: Square, offsets: number[][], board: Board, moverColor: Color | undefined): Square[] {
  const results: Square[] = [];

  for (const offset of offsets) {
    const newFile = from.file + offset[0];
    const newRank = from.rank + offset[1];

    if (!onBoard(board, newFile, newRank)) {
      continue;
    }

    const occupant = pieceAt(board, newFile, newRank);

    // A friendly piece blocks the square; anything else (empty, or enemy
    // when moverColor is known, or any piece when moverColor is unknown)
    // is a legal destination.
    if (occupant && occupant.color === moverColor) {
      continue;
    }

    results.push({ file: newFile, rank: newRank });
  }

  return results;
}
function slideMoves(from: Square, directions: number[][], board: Board, moverColor: Color | undefined): Square[] {
  const results: Square[] = [];

  for (const direction of directions) {
    let file = from.file + direction[0];
    let rank = from.rank + direction[1];

    while (onBoard(board, file, rank)) {
      const occupant = pieceAt(board, file, rank);

      if (occupant) {
        // Friendly piece blocks the slide before this square.
        if (occupant.color === moverColor) {
          break;
        }
        // Enemy piece (or unknown mover colour): capture square included,
        // slide stops here.
        results.push({ file, rank });
        break;
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
   return jumpMoves(from, KING_OFFSETS, board, moverColor(board, from));
}

export function knightMoves (from: Square, board: Board): Square[] {
    return jumpMoves(from, KNIGHT_OFFSETS, board, moverColor(board, from));
}

export function rookMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, ROOK_DIRECTIONS, board, moverColor(board, from));
}

export function bishopMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, BISHOP_DIRECTIONS, board, moverColor(board, from));
}

export function queenMoves (from: Square, board: Board): Square[] {
  return slideMoves(from, QUEEN_DIRECTIONS, board, moverColor(board, from));
}

export function pawnMoves(
  from: Square,
  board: Board,
  color: Color
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

    if (onBoard(board, captureFile, oneAhead)) {
      const occupant = pieceAt(board, captureFile, oneAhead);

      if (occupant && occupant.color !== color) {
        results.push({ file: captureFile, rank: oneAhead });
      }
    }
  }

  return results;
}
