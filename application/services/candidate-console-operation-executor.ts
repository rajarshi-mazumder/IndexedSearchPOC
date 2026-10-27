import { CandidateConsoleOperations } from "../ports/candidate-console-operations";
import { CandidateBatchFileInspector } from "../ports/candidate-batch-file-inspector";
import { OperationRequest, OperationResult, WorkerEvent } from "../../shared/candidate-console-contracts";

/** Coordinates a single console request; process and storage details stay behind ports. */
export class CandidateConsoleOperationExecutor {
  constructor(private readonly operations: CandidateConsoleOperations, private readonly files: CandidateBatchFileInspector) {}
  async execute(request: OperationRequest, report: (event: WorkerEvent) => void, signal: AbortSignal): Promise<OperationResult> {
    const settings = request.configuration;
    if (request.kind === "enrich") {
      const result = await this.operations.enrich(request, (progress) => report({ type: "progress", progress }), signal);
      const { preview, ...enrichment } = result;
      return { enrichment, candidates: preview.map((candidate) => ({ rank: 0, score: 0, candidate, profile: "" })) };
    }
    if (request.kind === "fetch") {
      report({ type: "progress", progress: { message: `Authenticating to Salesforce org ${settings.sfOrg}` } });
      const result = await this.operations.fetch(request, (progress) => {
        report({ type: "progress", progress: { fetched: progress.fetched, batchNumber: progress.batchNumber,
          message: progress.stage === "fetching" ? progress.message ?? `Fetching batch ${progress.batchNumber}` : `Saved batch ${progress.batchNumber}: ${progress.count} records`,
          file: progress.stage === "saved" ? progress.file.split(/[\\/]/).at(-1) : undefined } });
      }, signal);
      return { fetched: result.fetched, batchNumber: result.batchNumber, complete: result.complete };
    }
    if (request.kind === "setup") {
      report({ type: "progress", progress: { message: `Setting up ${settings.index} and verifying the embedding model` } });
      return { modelId: await this.operations.setup() };
    }
    if (request.kind === "search") {
      report({ type: "progress", progress: { message: `Searching ${settings.index}` } });
      const results = await this.operations.search(request.query, request.limit);
      return { candidates: results.map((result, index) => ({ rank: index + 1, score: result.score,
        candidate: result.document.candidate, profile: result.document.profile })) };
    }
    for (const [index, file] of [...request.files].sort().entries()) {
      if (signal.aborted) break;
      await this.files.validate(file);
      const before = await this.files.fingerprint(file);
      const result = await this.operations.index(file, (progress) => report({ type: "progress", progress: {
        ...progress, file, fileNumber: index + 1, fileTotal: request.files.length,
        message: `Embedding ${file}: ${progress.processed}/${progress.total} processed`,
      } }), signal);
      const after = await this.files.fingerprint(file);
      if (before.hash !== after.hash) throw new Error(`${file} changed during indexing. Retry the file to ensure consistent results.`);
      report({ type: "file", result: { file, ...result, ...after } });
    }
    return {};
  }
}
