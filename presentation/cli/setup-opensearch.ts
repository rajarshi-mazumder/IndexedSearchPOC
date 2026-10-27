import { errors } from "@opensearch-project/opensearch";
import { createSetupContext } from "../../bootstrap";
import { parseArgs } from "node:util";
import { OpenSearchCommandEnvironment } from "./open-search-command-environment";

async function main() {
  const { values } = parseArgs({ options: { index: { type: "string" } } });
  const context = createSetupContext(OpenSearchCommandEnvironment.create(process.env, values.index));
  console.log("Setting up OpenSearch index:", context.index);
  try {
    const modelId = await context.setup.execute();
    console.log("OpenSearch candidate setup complete. Remote embedding simulation passed.");
    console.log("Set this value in .env before indexing or searching:");
    console.log("OPENSEARCH_MODEL_ID=" + modelId);
    console.log("Allow up to 15 seconds for the new index and pipelines to become available.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OpenSearch setup failed");
  if (error instanceof errors.ResponseError) {
    const request = error.meta.meta.request.params;
    console.error("Failed request:", request.method, request.path);
    console.error("HTTP status:", error.statusCode);
    console.error("Endpoint:", process.env.OPENSEARCH_NODE);
    console.error("Signing region:", process.env.AWS_REGION ?? "ap-northeast-1");
    console.error("AWS profile:", process.env.AWS_PROFILE ?? "default credential chain");
    console.error("Response:", JSON.stringify(error.body, null, 2));
    // Transport metadata contains signed request headers. Print only response
    // identifiers/hints that can distinguish IAM and network-policy failures.
    for (const name of ["x-amzn-requestid", "x-amzn-request-id", "x-amzn-errortype", "x-aoss-response-hint"]) {
      if (error.headers?.[name]) console.error(name + ":", error.headers[name]);
    }
  }
  process.exitCode = 1;
});
