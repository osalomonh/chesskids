import { execSync } from "node:child_process";
import { readFileSync, copyFileSync, existsSync } from "node:fs";

const evalName = process.argv[2];
if (!evalName) {
  console.log("usage: npx tsx evals/run.ts <eval-name>");
  process.exit(1);
}

const dir = `evals/${evalName}`;
if (!existsSync(dir)) {
  console.log(`no such eval: ${dir}`);
  process.exit(1);
}

const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty) {
  console.log("REFUSING — working tree is dirty.");
  process.exit(1);
}

const task = readFileSync(`${dir}/task.md`, "utf8").trim();
if (!task) {
  console.log(`REFUSING — ${dir}/task.md is empty.`);
  process.exit(1);
}

// put the repo into the pre-task state
const fixture = `${dir}/setup/moves.ts`;
if (existsSync(fixture)) {
  copyFileSync(fixture, "moves.ts");
  console.log("staged fixture: moves.ts");
}

console.log(`\nrunning ${evalName}...\n`);

try {
  execSync(`claude -p ${JSON.stringify(task)}`, { stdio: "inherit" });
} catch {
  console.log("\nagent exited non-zero — checking anyway");
}

console.log("\n--- checks ---");
try {
  execSync("npx tsx evals/check.ts", { stdio: "inherit" });
} finally {
  execSync("git checkout -- moves.ts");
  console.log("\nrestored moves.ts");
}