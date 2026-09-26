// Snapshot a real run from the running backend into a trimmed test fixture.
//
//   node scripts/snapshot-bundle.mjs [runId] [baseUrl] [outFile]
//
// The fixture is real engine output, trimmed so it stays small: tests then
// exercise real shapes instead of hand-written numbers.
import { writeFileSync } from "node:fs";

const runId = process.argv[2] ?? "fani-2019-puri";
const base = process.argv[3] ?? "http://localhost:8080/api/v1";
const out = process.argv[4] ?? "tests/fixtures/run-bundle.json";

const get = async (path) => {
  const res = await fetch(`${base}/scenarios/${runId}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const [detail, hazard, exposure, assets, decisions, parametric, validation, advisories] =
  await Promise.all(
    ["", "/hazard", "/exposure", "/assets", "/decisions", "/parametric", "/validation", "/advisories"].map(get),
  );

hazard.track = hazard.track.filter((_, i) => i % 6 === 0);
exposure.clusters = exposure.clusters.slice(0, 12);
assets.shelters = [
  ...assets.shelters.filter((s) => s.status === "compromised").slice(0, 14),
  ...assets.shelters.filter((s) => s.status !== "compromised").slice(0, 10),
];
decisions.assignments = decisions.assignments.slice(0, 12);
decisions.unassigned = decisions.unassigned.slice(0, 8);
decisions.actions = decisions.actions.slice(0, 16);

const bundle = { detail, hazard, exposure, assets, decisions, parametric, validation, advisories };
writeFileSync(out, `${JSON.stringify(bundle, null, 1)}\n`);
console.log(`wrote ${out} from ${runId}`);
