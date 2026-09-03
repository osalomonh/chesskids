import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const evalName = process.argv[2];
if (!evalName) {
  console.log("usage: npx tsx evals/run.ts <eval-name>");
  process.exit(1);
}

const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty) {
  console.log("REFUSING — working tree is dirty.");
  process.exit(1);
}

const task = readFileSync(`evals/${evalName}/task.md`, "utf8");

console.log(`running ${evalName}...\n`);

execSync(`claude -p ${JSON.stringify(task)}`, { stdio: "inherit" });

console.log("\n--- checks ---");
execSync("npx tsx evals/check.ts", { stdio: "inherit" });