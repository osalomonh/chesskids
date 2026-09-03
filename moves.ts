export type Square = { file: number; rank: number };
export type Board = { size: number; occupied: Square[] };


export function kingMoves (from: Square, board: Board): Square[] {
  const offsets = [
    [0,1], [1,0], [0,-1], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1],
  ];

  const results: Square[] = [];

  for (const offset of offsets) {
    const newFile = from.file + offset[0];
    const newRank = from.rank + offset[1];

    const onBoard = 
      newFile >= 0 && newFile < board.size && 
      newRank >= 0 && newRank < board.size;
      
    if (onBoard) {
      results.push({ file: newFile, rank: newRank });
    }
  } 

  return results;
}

export function knightMoves (from: Square, board: Board): Square[] {
  const offsets = [
    [2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2],
  ];

  const results: Square[] = [];

  for (const offset of offsets) {
    const newFile = from.file + offset[0];
    const newRank = from.rank + offset[1];

    const onBoard = 
      newFile >= 0 && newFile < board.size && 
      newRank >= 0 && newRank < board.size;
      
    if (onBoard) {
      results.push({ file: newFile, rank: newRank });
    }
  } 

  return results;
}

export function rookMoves (from: Square, board: Board): Square[] {
  const directions = [ [0,1], [1,0], [0,-1], [-1,0] ];

  const results: Square[] = [];

  for (const direction of directions) {
    let file = from.file + direction[0];
    let rank = from.rank + direction[1];

    while (file >= 0 && file < board.size && rank >= 0 && rank < board.size) {
      // Check if the square is occupied
      if (board.occupied.some(sq => sq.file === file && sq.rank === rank)) {
        break; // Stop if the square is occupied
      }
      results.push({ file, rank});
      file += direction[0];
      rank += direction[1];
    } 
  }
  return results;
}

export function bishopMoves (from: Square, board: Board): Square[] {
  const directions = [ [1,1], [1,-1], [-1,1], [-1,-1] ];

  const results: Square[] = [];

  for (const direction of directions) {
    let file = from.file + direction[0];
    let rank = from.rank + direction[1];

    while (file >= 0 && file < board.size && rank >= 0 && rank < board.size) {
      // Check if the square is occupied
      if (board.occupied.some(sq => sq.file === file && sq.rank === rank)) {
        break; // Stop if the square is occupied
      }
      results.push({ file, rank});
      file += direction[0];
      rank += direction[1];
    } 
  }
  return results;
}


export function queenMoves (from: Square, board: Board): Square[] {
  const directions = [ [0,1], [0,-1], [-1,0], [1,0], [1,1], [1,-1], [-1,1], [-1,-1] ];

  const results: Square[] = [];

  for (const direction of directions) {
    let file = from.file + direction[0];
    let rank = from.rank + direction[1];

    while (file >= 0 && file < board.size && rank >= 0 && rank < board.size) {
      // Check if the square is occupied
      if (board.occupied.some(sq => sq.file === file && sq.rank === rank)) {
        break; // Stop if the square is occupied
      }
      results.push({ file, rank});
      file += direction[0];
      rank += direction[1];
    } 
  }
  return results;
}

