import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflowDirectory = join(process.cwd(), ".github", "workflows");
const sha = /^[0-9a-f]{40}$/;
const failures: string[] = [];

for (const file of readdirSync(workflowDirectory)) {
  if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
  const lines = readFileSync(join(workflowDirectory, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    const match = line.match(/\buses:\s*([^\s#]+)/);
    if (!match || match[1].startsWith("./")) return;
    const reference = match[1].split("@")[1];
    if (!reference || !sha.test(reference)) failures.push(`${file}:${index + 1}`);
  });
}

if (failures.length) {
  throw new Error(`Unpinned GitHub Actions: ${failures.join(", ")}`);
}
console.log("GitHub Actions audit passed: all external actions use full commit SHAs.");
