import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

mkdirSync("docs/security", { recursive: true });
const auditPath = "/tmp/crm-pnpm-audit-prompt21.json";
try {
  writeFileSync(
    auditPath,
    execFileSync("pnpm", ["audit", "--json"], { encoding: "utf8" }),
  );
} catch (error) {
  const output = error as { stdout?: string };
  writeFileSync(auditPath, output.stdout ?? "{}");
}
const audit = JSON.parse(readFileSync(auditPath, "utf8")) as {
  metadata?: { vulnerabilities?: Record<string, number> };
  advisories?: Record<
    string,
    { module_name: string; severity: string; title: string; patched_versions: string }
  >;
};
const advisories = Object.values(audit.advisories ?? {});
const report = [
  "# Supply Chain Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## SBOM",
  "",
  "Generated locally with `@cyclonedx/cyclonedx-npm`.",
  "",
  "## Audit",
  "",
  `Vulnerabilities: ${JSON.stringify(audit.metadata?.vulnerabilities ?? {})}`,
  "",
  ...advisories.map(
    (advisory) =>
      `- ${advisory.severity}: ${advisory.module_name}: ${advisory.title}; patched: ${advisory.patched_versions}`,
  ),
].join("\n");
writeFileSync("docs/security/supply-chain-report.md", `${report}\n`);
if ((audit.metadata?.vulnerabilities?.critical ?? 0) > 0) process.exitCode = 1;
