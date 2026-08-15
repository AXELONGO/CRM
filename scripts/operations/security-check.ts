import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ignored = new Set(["node_modules", ".next", ".git", "coverage", "test-results"]);
const suspicious = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:sk_live_|rk_live_|whsec_|access_token\s*[:=]\s*[A-Za-z0-9_-]{20,})/i,
  /postgres(?:ql)?:\/\/[^\s/]+:[^\s@]+@(?!127\.0\.0\.1|localhost|example\.com)/i,
];
const roots = [
  "src",
  "scripts",
  "docs",
  ".github",
  "Dockerfile",
  "compose.yaml",
  "railway.toml",
];
const files: string[] = [];
function walk(path: string) {
  const stat = statSync(path);
  if (stat.isFile()) {
    files.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!ignored.has(entry) && !entry.startsWith(".env")) walk(join(path, entry));
  }
}
for (const root of roots) walk(root);
const findings: string[] = [];
for (const file of files) {
  if (file.endsWith("security-check.ts")) continue;
  const content = readFileSync(file, "utf8");
  if (suspicious.some((pattern) => pattern.test(content))) findings.push(file);
}
if (findings.length) {
  console.error(`Potential secret material found in ${findings.length} file(s).`);
  process.exit(1);
}
console.log(`Security scan passed: ${files.length} tracked candidate files inspected.`);
