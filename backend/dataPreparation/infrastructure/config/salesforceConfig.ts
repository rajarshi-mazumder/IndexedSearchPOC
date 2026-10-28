import { z } from "zod";

function parseRecordTypeNames(value: string): string[] {
  const names: string[] = [];
  for (const item of value.split(",")) {
    names.push(item.trim());
  }
  return names;
}

const schema = z.object({
  SF_TARGET_ORG: z.string().trim().regex(/^[a-zA-Z0-9_.@+-]+$/, "Use a Salesforce org alias or username"),
  SF_CANDIDATE_RECORD_TYPES: z.string().default("Candidate,CandidatePreReg")
    .transform(parseRecordTypeNames)
    .pipe(z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).min(1)),
  SF_TAG_TYPE_MAP: z.string().default("{}").transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    }
    catch {
      context.addIssue({
        code: "custom",
        message: "SF_TAG_TYPE_MAP must be a JSON object"
      });
      return z.NEVER;
    }
  }).pipe(z.record(z.string(), z.enum([
    "skills", "skillCategories", "systems", "industries", "subIndustries", "jobFunctions", "language", "proficiency",
  ]))),
});

export function loadSalesforceConfig(environment: NodeJS.ProcessEnv) {
  return schema.parse(environment);
}
