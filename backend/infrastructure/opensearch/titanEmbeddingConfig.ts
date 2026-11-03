export const TITAN_MODEL_ID = "amazon.titan-embed-text-v2:0";
export const TITAN_DIMENSIONS = 1024;
export const CANDIDATE_SCHEMA_VERSION = 4;

/** Each searchable vector and the document text it embeds; setup, mapping checks and queries share this list. */
export const CANDIDATE_VECTOR_FIELDS = {
  overall: { text: "searchText", vector: "embedding" },
  skills: { text: "skillsText", vector: "skillsEmbedding" },
  languages: { text: "languagesText", vector: "languagesEmbedding" },
  region: { text: "regionText", vector: "regionEmbedding" },
} as const;
