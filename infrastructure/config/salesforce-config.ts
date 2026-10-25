import { z } from "zod";

const schema = z.object({
  SF_TARGET_ORG: z.string().trim().regex(/^[a-zA-Z0-9_.@+-]+$/, "Use a Salesforce org alias or username"),
});

export function loadSalesforceConfig(environment: NodeJS.ProcessEnv) {
  return schema.parse(environment);
}
