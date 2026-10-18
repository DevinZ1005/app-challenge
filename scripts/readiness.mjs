import { readFile, access, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
const root = process.cwd();
const checklist = JSON.parse(
  await readFile(resolve(root, "docs/launch-checklist.json"), "utf8"),
);
const ids = new Set();
const results = [];
for (const item of checklist.requirements) {
  const errors = [];
  if (!item.id || ids.has(item.id))
    errors.push("Missing or duplicate requirement ID");
  ids.add(item.id);
  if (!["implemented", "pending", "not-applicable"].includes(item.status))
    errors.push("Invalid status");
  if (
    !item.owner ||
    !item.acceptance ||
    !item.reason ||
    !Array.isArray(item.evidence)
  )
    errors.push("Incomplete handoff entry");
  if (item.status === "implemented" && !item.evidence?.length)
    errors.push("Implemented requirement has no source evidence");
  for (const path of item.evidence || []) {
    const location = resolve(root, path);
    const rel = relative(root, location);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      errors.push(`Evidence outside project: ${path}`);
      continue;
    }
    try {
      await access(location);
    } catch {
      errors.push(`Missing evidence: ${path}`);
    }
  }
  results.push({ ...item, errors });
}
const invalid = results.filter((r) => r.errors.length);
const blockers = results.filter(
  (r) => r.releaseBlocker && r.status === "pending",
);
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Checks handoff integrity and evidence file existence. Does not run tests or prove behavior, deployment, security, or accessibility conformance.",
  releaseApproved: false,
  implementationEvidenceValid: invalid.length === 0,
  unresolvedReleaseBlockers: blockers.map((b) => b.id),
  results,
};
await mkdir(resolve(root, "artifacts"), { recursive: true });
await writeFile(
  resolve(root, "artifacts/readiness.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `${results.length} requirements: ${results.filter((r) => r.status === "implemented").length} implemented, ${results.filter((r) => r.status === "pending").length} pending, ${results.filter((r) => r.status === "not-applicable").length} not applicable.`,
);
console.log(
  "Evidence checks only; run npm run check and npm run test:e2e for behavior verification.",
);
for (const item of invalid) console.error(item.id, item.errors.join("; "));
console.log(
  `Public launch blockers: ${blockers.map((b) => b.id).join(", ") || "none recorded"}. Human release approval is always required.`,
);
if (invalid.length || (process.argv.includes("--release") && blockers.length))
  process.exitCode = 1;
