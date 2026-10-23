import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  OPENSEARCH_NODE: z.string().url(),
  OPENSEARCH_USERNAME: z.string().min(1),
  OPENSEARCH_PASSWORD: z.string().min(1),
  OPENSEARCH_INDEX: z.string().min(1),
  OPENSEARCH_SEARCH_PIPELINE: z.string().min(1).default("candidate-hybrid-search"),
});

export const opensearchConfig = schema.parse(process.env);
