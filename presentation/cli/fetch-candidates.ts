import "dotenv/config";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
import { createCandidateBatchExportContext, createCandidateSnapshotExportContext } from "../../bootstrap";
import { loadSalesforceConfig } from "../../infrastructure/config/salesforce-config";
import { CliOperationProgress } from "./cli-operation-progress";

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      file: { type: "string" }, org: { type: "string" }, "output-dir": { type: "string" },
      "batch-size": { type: "string" }, "max-batches": { type: "string" }, resume: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });
  const ids = z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)).parse(positionals);
  const options = z.object({
    file: z.string().trim().min(1).optional(), directory: z.string().trim().min(1).optional(),
    batchSize: z.coerce.number().int().min(1).max(1000), maxBatches: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  }).parse({ file: values.file, directory: values["output-dir"], batchSize: values["batch-size"] ?? "1000", maxBatches: values["max-batches"] ?? "1" });
  if (options.file && (!ids.length || options.directory || values.resume || values["batch-size"] || values["max-batches"])) {
    throw new Error("--file is for selected contact IDs only. For full exports use --output-dir, --batch-size, and --max-batches.");
  }
  if (ids.length && !options.file) throw new Error("Selected contact IDs require --file. Batch exports use --output-dir without IDs.");
  const environment = { ...process.env, ...(values.org === undefined ? {} : { SF_TARGET_ORG: values.org }) };
  const org = loadSalesforceConfig(environment).SF_TARGET_ORG;
  const progress = new CliOperationProgress();
  progress.start(`Authenticating to Salesforce org ${org} (CLI commands time out after 120 seconds)`);
  const controller = new AbortController();
  const stop = () => { controller.abort(); progress.update("Stop requested; finishing the current batch and saving its checkpoint."); };
  process.once("SIGINT", stop);
  try {
    if (options.file) {
      const file = resolve(options.file);
      const context = createCandidateSnapshotExportContext(file, environment);
      progress.update(`Fetching ${ids.length} selected contacts`);
      const result = await context.exportCandidateSnapshot.execute(ids);
      progress.update(`Salesforce candidates saved: ${result.fetched}. Candidate snapshot: ${file}`);
      return;
    }
    const directory = resolve(options.directory ?? `.cache/candidates/${org}`);
    const context = createCandidateBatchExportContext(directory, environment);
    progress.update(`Export directory: ${directory}. Up to ${options.maxBatches} new file(s), ${options.batchSize} records each.`);
    const result = await context.exportCandidateBatches.execute({
      org, sourceId: context.sourceId, batchSize: options.batchSize, maxBatches: options.maxBatches, resume: values.resume,
    }, (event) => {
      if (event.stage === "fetching") progress.update(`Fetching batch ${event.batchNumber}; ${event.fetched} records previously saved`);
      else progress.update(`Saved batch ${event.batchNumber}: ${event.count} records; ${event.fetched} total. File: ${event.file}`);
    }, controller.signal);
    progress.update(`Export ${result.complete ? "complete" : "paused"}: ${result.fetched} records in ${result.batchNumber} files.`);
    if (!result.complete) console.log("Continue with the same --org, --output-dir and --batch-size, plus --resume and --max-batches.");
    if (controller.signal.aborted) process.exitCode = 130;
  } finally {
    progress.stop();
    process.removeListener("SIGINT", stop);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Candidate export failed");
  process.exitCode = 1;
});
