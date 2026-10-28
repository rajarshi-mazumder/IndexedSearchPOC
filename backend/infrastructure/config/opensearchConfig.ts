import { z } from "zod";

const resourceName = z.string().regex(/^[a-z][a-z0-9-]*$/).max(100);
const baseSchema = z.object({
  AWS_REGION: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/).default("ap-northeast-1"),
  OPENSEARCH_NODE: z.string().url().refine((value) => {
    const url = new URL(value);
    const serverlessHost = /^[a-z0-9-]+\.[a-z]{2}-[a-z]+-\d\.aoss\.amazonaws\.com$/.test(url.hostname) ||
      /^[a-z0-9-]+\.aoss\.[a-z]{2}-[a-z]+-\d\.on\.aws$/.test(url.hostname);
    return url.protocol === "https:" && serverlessHost &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  }, "Use the HTTPS OpenSearch Serverless collection endpoint"),
  OPENSEARCH_INDEX: resourceName.default("candidates-titan-v2"),
  OPENSEARCH_INGEST_PIPELINE: resourceName.default("candidate-titan-v2-ingest"),
  OPENSEARCH_SEARCH_PIPELINE: resourceName.default("candidate-titan-v2-hybrid"),
});
const runtimeSchema = baseSchema.extend({ OPENSEARCH_MODEL_ID: z.string().trim().min(1) });
const setupSchema = baseSchema.extend({
  BEDROCK_ROLE_ARN: z.string().regex(/^arn:aws:iam::\d{12}:role\/.+$/),
  OPENSEARCH_MODEL_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
});

export type OpenSearchConfig = z.infer<typeof runtimeSchema>;
export type OpenSearchSetupConfig = z.infer<typeof setupSchema>;
export type OpenSearchConnectionConfig = Pick<OpenSearchConfig, "AWS_REGION" | "OPENSEARCH_NODE">;
export type OpenSearchIndexConfig = Pick<OpenSearchConfig, "OPENSEARCH_INDEX" | "OPENSEARCH_INGEST_PIPELINE">;

export function loadOpenSearchConfig(environment: NodeJS.ProcessEnv): OpenSearchConfig {
  return runtimeSchema.parse(environment);
}

export function loadOpenSearchSetupConfig(environment: NodeJS.ProcessEnv): OpenSearchSetupConfig {
  return setupSchema.parse(environment);
}
