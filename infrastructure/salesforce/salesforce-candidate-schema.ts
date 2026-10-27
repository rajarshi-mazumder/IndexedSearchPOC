import { SalesforceQueryClient } from "./salesforce-query-client";

/** Metadata cache is scoped to one operation, never shared across orgs. */
export class SalesforceCandidateSchema {
  private readonly cache = new Map<string, Promise<Awaited<ReturnType<SalesforceQueryClient["describe"]>>>>();
  constructor(private readonly client: SalesforceQueryClient) {}
  async select(object: string, required: string[], optional: string[]) {
    let description = this.cache.get(object);
    if (!description) { description = this.client.describe(object); this.cache.set(object, description); }
    const metadata = await description;
    if (!metadata.queryable) throw new Error(`Salesforce object is not queryable: ${object}`);
    const fields = new Map(metadata.fields.map((field) => [field.name, field]));
    for (const name of required) if (!fields.has(name)) throw new Error(`Required Salesforce field unavailable: ${object}.${name}`);
    return { fields: [...required, ...optional.filter((name) => fields.has(name))],
      missing: optional.filter((name) => !fields.has(name)).map((name) => `Unavailable field: ${object}.${name}`), metadata: fields };
  }
}
