import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
import { createDemoIndexingContext, createIndexingContext, createJsonIndexingContext, DEFAULT_CANDIDATE_SNAPSHOT_FILE } from "../../bootstrap";

const argumentsSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("salesforce"), ids: z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)) }),
  z.object({ source: z.literal("dummy"), ids: z.array(z.string().regex(/^demo-[a-z0-9-]+$/)) }),
  z.object({ source: z.literal("json"), ids: z.array(z.string().min(1)) }),
]);

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      source: { type: "string", default: "salesforce" },
      file: { type: "string", default: DEFAULT_CANDIDATE_SNAPSHOT_FILE },
    },
    allowPositionals: true,
  });
  const { source, ids } = argumentsSchema.parse({ source: values.source, ids: positionals });
  const snapshotFile = resolve(z.string().trim().min(1).parse(values.file));
  const context = source === "dummy" ? createDemoIndexingContext()
    : source === "json" ? createJsonIndexingContext(snapshotFile) : createIndexingContext(snapshotFile);
  try {
    console.log("Indexing accepted (" + source + "):", await context.indexCandidates.execute(ids.length ? ids : undefined));
    if (source !== "dummy") console.log("Candidate snapshot:", snapshotFile);
    console.log("Allow approximately 10-15 seconds for updates to become searchable.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Indexing failed");
  process.exitCode = 1;
});
