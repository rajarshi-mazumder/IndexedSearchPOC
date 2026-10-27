import { z } from "zod";

// An explicit index selects matching pipeline names consistently for setup,
// indexing, and search. Without --index, existing environment settings apply.
export class OpenSearchCommandEnvironment {
  static create(environment: NodeJS.ProcessEnv, index?: string): NodeJS.ProcessEnv {
    if (index === undefined) return { ...environment };
    const name = z.string().regex(/^[a-z][a-z0-9-]*$/).max(93).parse(index);
    return { ...environment, OPENSEARCH_INDEX: name,
      OPENSEARCH_INGEST_PIPELINE: name + "-ingest", OPENSEARCH_SEARCH_PIPELINE: name + "-hybrid" };
  }
}
