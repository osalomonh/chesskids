import { execSync } from "node:child_process";

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

console.log("check:", gate("npm run check") ? "PASS" : "FAIL");
console.log("test: ", gate("npm test") ? "PASS" : "FAIL");

const allowed = ["moves.ts"];
const changed = changedFiles();
const violations = changed.filter(f => !allowed.includes(f));

console.log("scope:", violations.length === 0
  ? "PASS"
  : `FAIL — touched ${violations.join(", ")}`);