import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
import { createCandidateSnapshotExportContext, DEFAULT_CANDIDATE_SNAPSHOT_FILE } from "../../bootstrap";

async function main() {
  const { values, positionals } = parseArgs({
    options: { file: { type: "string", default: DEFAULT_CANDIDATE_SNAPSHOT_FILE } },
    allowPositionals: true,
  });
  const ids = z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)).parse(positionals);
  const snapshotFile = resolve(z.string().trim().min(1).parse(values.file));
  const context = createCandidateSnapshotExportContext(snapshotFile);
  const result = await context.exportCandidateSnapshot.execute(ids.length ? ids : undefined);
  console.log("Salesforce candidates saved:", result.fetched);
  console.log("Candidate snapshot:", snapshotFile);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Candidate export failed");
  process.exitCode = 1;
});
