import { createSetupContext } from "../../bootstrap";

async function main() {
  const context = createSetupContext();
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
  process.exitCode = 1;
});
