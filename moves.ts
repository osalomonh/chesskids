//logic defining the moves of chess pieces on a board 

//types
export type Square = { file: number; rank: number };
export type Color = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Piece = { square: Square; color: Color; type: PieceType };
export type Board = { size: number; pieces: Piece[] };

//constants
type Offset = readonly [number, number];

const KING_OFFSETS: readonly Offset[] = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
const KNIGHT_OFFSETS: readonly Offset[] = [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]];
const ROOK_DIRECTIONS: readonly Offset[] = [[0,1], [1,0], [0,-1], [-1,0]];
const BISHOP_DIRECTIONS: readonly Offset[] = [[1,1], [1,-1], [-1,1], [-1,-1]];
const QUEEN_DIRECTIONS: readonly Offset[] = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

//helpers
const pieceAt = (board: Board, file: number, rank: number): Piece | undefined =>
  board.pieces.find(p => p.square.file === file && p.square.rank === rank);
const isOccupied = (board: Board, file: number, rank: number) =>
  pieceAt(board, file, rank) !== undefined;
const onBoard = (board: Board, file: number, rank: number) =>
  file >= 0 && file < board.size && rank >= 0 && rank < board.size;

// Finds the colour of the piece standing at `from`. If no piece stands
// there, the mover has no colour, and there is no piece to move — callers
// return [] in that case rather than generating moves for a phantom piece.
const moverColor = (board: Board, from: Square): Color | undefined =>
  pieceAt(board, from.file, from.rank)?.color;

//functions
function jumpMoves(from: Square, offsets: readonly Offset[], board: Board, moverColor: Color | undefined): Square[] {
  // No piece at `from` means no colour, and no piece to move.
  if (moverColor === undefined) {
    return [];
  }

  const results: Square[] = [];

  for (const offset of offsets) {
    const newFile = from.file + offset[0];
    const newRank = from.rank + offset[1];

    if (!onBoard(board, newFile, newRank)) {
      continue;
    }

    const occupant = pieceAt(board, newFile, newRank);

    // A friendly piece blocks the square; anything else (empty, or enemy)
    // is a legal destination.
    if (occupant && occupant.color === moverColor) {
      continue;
    }

    results.push({ file: newFile, rank: newRank });
  }

  return results;
}
function slideMoves(from: Square, directions: readonly Offset[], board: Board, moverColor: Color | undefined): Square[] {
  // No piece at `from` means no colour, and no piece to move.
  if (moverColor === undefined) {
    return [];
  }

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
        // Enemy piece: capture square included, slide stops here.
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
  board: Board
): Square[] {

  const color = moverColor(board, from);

  // No piece at `from` means no colour, and therefore no direction to
  // move in. Unlike the jump/slide pieces, a pawn's whole move set is
  // colour-dependent, so there is nothing sensible to return but [].
  if (color === undefined) {
    return [];
  }

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
//dispatch
// A move carries both ends. `from` alone leaves the caller to track the
// origin separately, and the two could disagree; one object cannot.
// Nothing derivable from `from`, `to`, and the board belongs here.
export type Move = { from: Square; to: Square };

// Reads the piece at `from` and dispatches to that piece's move function,
// wrapping each destination square as a Move. Additive: the six per-piece
// functions are unchanged and none of their logic is reimplemented here.
export function movesFrom(from: Square, board: Board): Move[] {
  const piece = pieceAt(board, from.file, from.rank);

  // No piece at `from` means no mover and nothing to dispatch on.
  if (piece === undefined) {
    return [];
  }

  const destinations = destinationsFor(piece.type, from, board);

  return destinations.map(to => ({ from, to }));
}

// Exhaustive over PieceType: adding a piece type without a case here is a
// compile error, because `never` accepts nothing.
function destinationsFor(type: PieceType, from: Square, board: Board): Square[] {
  switch (type) {
    case "king":   return kingMoves(from, board);
    case "queen":  return queenMoves(from, board);
    case "rook":   return rookMoves(from, board);
    case "bishop": return bishopMoves(from, board);
    case "knight": return knightMoves(from, board);
    case "pawn":   return pawnMoves(from, board);
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}
