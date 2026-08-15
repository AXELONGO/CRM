import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/operations/restore-drill.ts"],
  {
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
