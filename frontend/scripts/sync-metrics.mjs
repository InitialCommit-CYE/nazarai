// Copies the evaluation artefact ml/reports/metrics.json into the frontend bundle, unchanged, so the
// Model Performance page works even when the ML service is down or not deployed yet.
// Runs automatically before `npm run build`. If the source is not reachable (e.g. a build that only
// sees frontend/), the committed copy is kept as is.
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "ml", "reports", "metrics.json");
const dst = join(here, "..", "lib", "server", "data", "metrics.json");

if (!existsSync(src)) {
  console.log(`sync-metrics: ${src} not found, keeping the committed copy`);
} else {
  const version = JSON.parse(readFileSync(src, "utf8")).model?.model_version ?? "unknown";
  copyFileSync(src, dst);
  console.log(`sync-metrics: copied metrics.json (${version})`);
}
