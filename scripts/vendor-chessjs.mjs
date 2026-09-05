// Copies the chess.js ESM bundle out of node_modules so board.html can load it
// through its import map (see the <script type="importmap"> in board.html).
// The bundle is a single self-contained file that keeps its BSD-2-Clause
// licence header, which is what lets us redistribute it in dist/.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("vendor", { recursive: true });
copyFileSync("node_modules/chess.js/dist/esm/chess.js", "vendor/chess.js");
console.log("vendored node_modules/chess.js/dist/esm/chess.js -> vendor/chess.js");
