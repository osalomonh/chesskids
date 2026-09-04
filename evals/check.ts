import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// --- helpers ---

function gate(command: string): boolean {
  try {
    execSync(command, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const changedFiles = (): string[] =>
  execSync("git diff --name-only HEAD", { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);

// --- checks ---

console.log("check:", gate("npm run check") ? "PASS" : "FAIL");
console.log("test: ", gate("npm test") ? "PASS" : "FAIL");

const tsconfig = readFileSync("tsconfig.json", "utf8");
const strictIndexing = tsconfig.includes('"noUncheckedIndexedAccess": true');

console.log("types honest:", strictIndexing ? "PASS" : "FAIL — strict indexing disabled");

const allowed = ["moves.ts"];
const violations = changedFiles().filter(f => !allowed.includes(f));

console.log("scope:", violations.length === 0
  ? "PASS"
  : `FAIL — touched ${violations.join(", ")}`);