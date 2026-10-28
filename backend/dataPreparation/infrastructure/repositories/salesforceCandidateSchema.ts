import { SalesforceQueryClient } from "./salesforceQueryClient";

type ObjectDescription = Awaited<ReturnType<SalesforceQueryClient["describe"]>>;

type FieldDescription = ObjectDescription["fields"][number];

export interface SalesforceFieldSelection {
  fields: string[];
  missing: string[];
  metadata: Map<string, FieldDescription>;
}

/** Metadata cache is scoped to one operation, never shared across orgs. */
export class SalesforceCandidateSchema {
  private readonly cache = new Map<string, Promise<ObjectDescription>>();

  public constructor(private readonly client: SalesforceQueryClient) { }

  public async select(object: string, required: string[], optional: string[]): Promise<SalesforceFieldSelection> {
    const description = await this.describeObjectOnce(object);
    if (!description.queryable) {
      throw new Error(`Salesforce object is not queryable: ${object}`);
    }
    const metadata = this.indexFieldsByName(description.fields);
    this.requireFields(object, required, metadata);
    return this.selectAvailableFields(object, required, optional, metadata);
  }

  private describeObjectOnce(object: string): Promise<ObjectDescription> {
    let description = this.cache.get(object);
    if (!description) {
      description = this.client.describe(object);
      this.cache.set(object, description);
    }
    return description;
  }

  private indexFieldsByName(fields: FieldDescription[]): Map<string, FieldDescription> {
    const indexed = new Map<string, FieldDescription>();
    for (const field of fields) {
      indexed.set(field.name, field);
    }
    return indexed;
  }

  private requireFields(object: string, fields: string[], metadata: Map<string, FieldDescription>): void {
    for (const field of fields) {
      if (!metadata.has(field)) {
        throw new Error(`Required Salesforce field unavailable: ${object}.${field}`);
      }
    }
  }

  private selectAvailableFields(
    object: string,
    required: string[],
    optional: string[],
    metadata: Map<string, FieldDescription>
  ): SalesforceFieldSelection {
    const fields = [...required];
    const missing: string[] = [];
    for (const field of optional) {
      if (metadata.has(field)) {
        fields.push(field);
      }
      else {
        missing.push(`Unavailable field: ${object}.${field}`);
      }
    }
    return {
      fields,
      missing,
      metadata
    };
  }
}
