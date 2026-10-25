import { parseArgs } from "node:util";
import { z } from "zod";
import { createDemoIndexingContext, createIndexingContext } from "../../bootstrap";

const argumentsSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("salesforce"), ids: z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)) }),
  z.object({ source: z.literal("dummy"), ids: z.array(z.string().regex(/^demo-[a-z0-9-]+$/)) }),
]);

async function main() {
  const { values, positionals } = parseArgs({
    options: { source: { type: "string", default: "salesforce" } },
    allowPositionals: true,
  });
  const { source, ids } = argumentsSchema.parse({ source: values.source, ids: positionals });
  const context = source === "dummy" ? createDemoIndexingContext() : createIndexingContext();
  try {
    console.log("Indexing accepted (" + source + "):", await context.indexCandidates.execute(ids.length ? ids : undefined));
    console.log("Allow approximately 10-15 seconds for updates to become searchable.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Indexing failed");
  process.exitCode = 1;
});
