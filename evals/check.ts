import { execSync } from "node:child_process";

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

// --- guard: refuse to run against an unknown starting state ---

const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty) {
  console.log("REFUSING — working tree is dirty. Commit or stash first.");
  process.exit(1);
}

// --- checks ---

console.log("check:", gate("npm run check") ? "PASS" : "FAIL");
console.log("test: ", gate("npm test") ? "PASS" : "FAIL");

const allowed = ["moves.ts"];
const violations = changedFiles().filter(f => !allowed.includes(f));

console.log("scope:", violations.length === 0
  ? "PASS"
  : `FAIL — touched ${violations.join(", ")}`);