export {};

const target = process.env.LOAD_TARGET ?? "http://127.0.0.1:3000";
const enabled = process.env.RUN_LOCAL_LOAD === "true";
const concurrency = Math.max(
  1,
  Math.min(25, Number(process.env.LOAD_CONCURRENCY ?? 25)),
);
const requests = Math.max(
  20,
  Math.min(1_000, Number(process.env.LOAD_REQUESTS ?? 100)),
);
const parsed = new URL(target);
if (!enabled) {
  console.log(
    "Load smoke skipped: set RUN_LOCAL_LOAD=true explicitly for local execution.",
  );
  process.exit(0);
}
if (!["localhost", "127.0.0.1"].includes(parsed.hostname))
  throw new Error("LOAD_TARGET_MUST_BE_LOCAL");
const samples: number[] = [];
let errors = 0;
let completed = 0;
async function worker() {
  while (true) {
    const index = completed++;
    if (index >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(`${target}/api/health/live`);
      if (!response.ok) {
        errors += 1;
        continue;
      }
      samples.push(performance.now() - started);
    } catch {
      errors += 1;
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
samples.sort((a, b) => a - b);
const percentile = (value: number) =>
  samples[Math.min(samples.length - 1, Math.ceil(samples.length * value) - 1)];
console.log(
  JSON.stringify({
    target,
    requests: samples.length,
    concurrency,
    p50_ms: percentile(0.5),
    p95_ms: percentile(0.95),
    p99_ms: percentile(0.99),
    errors,
  }),
);
if (errors > 0 || samples.length !== requests) throw new Error(`LOAD_ERRORS:${errors}`);
