import { Connection, Record as SalesforceRecord } from "jsforce";
import { z } from "zod";

const pageSchema = z.object({
  done: z.boolean(),
  records: z.array(z.record(z.string(), z.unknown())),
  nextRecordsUrl: z.string().optional(),
}).refine((page) => {
  return page.done || page.records.length > 0;
}, "Salesforce returned an empty unfinished page");

const descriptionSchema = z.object({
  queryable: z.boolean(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    referenceTo: z.array(z.string()).optional(),
  })),
});

export class SalesforceQueryClient {
  public constructor(private readonly connection: Connection) { }

  public async describe(object: string): Promise<z.infer<typeof descriptionSchema>> {
    z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).parse(object);
    const url = `/services/data/v${this.connection.version}/sobjects/${object}/describe`;
    const response = await this.request(url);
    return descriptionSchema.parse(response);
  }

  public async queryBatch(soql: string, limit: number): Promise<SalesforceRecord[]> {
    z.number().int().min(1).max(1000).parse(limit);
    return this.readPages(soql, limit);
  }

  public async query<T extends SalesforceRecord = SalesforceRecord>(soql: string): Promise<T[]> {
    return await this.readPages(soql, 100000) as T[];
  }

  private async request(url: string): Promise<unknown> {
    return this.connection.request({
      method: "GET",
      url
    }, {
      timeout: 120000
    });
  }

  private async readPages(soql: string, limit: number): Promise<SalesforceRecord[]> {
    let url = `/services/data/v${this.connection.version}/query?q=${encodeURIComponent(soql)}`;
    const records: SalesforceRecord[] = [];
    const visited = new Set<string>();
    while (true) {
      this.recordContinuationUrl(url, visited);
      const response = await this.request(url);
      const page = pageSchema.parse(response);
      this.appendPageRecords(records, page.records, limit);
      if (page.done) {
        return records;
      }
      url = this.readContinuationUrl(page);
    }
  }

  private recordContinuationUrl(url: string, visited: Set<string>): void {
    if (visited.has(url)) {
      throw new Error("Salesforce repeated a continuation URL");
    }
    visited.add(url);
  }

  private appendPageRecords(records: SalesforceRecord[], pageRecords: SalesforceRecord[], limit: number): void {
    if (records.length + pageRecords.length > limit) {
      throw new Error("Salesforce exceeded the requested batch limit");
    }
    records.push(...pageRecords);
  }

  private readContinuationUrl(page: z.infer<typeof pageSchema>): string {
    if (!page.nextRecordsUrl || !/^\/services\/data\/v[\d.]+\/query\/[a-zA-Z0-9-]+$/.test(page.nextRecordsUrl)) {
      throw new Error("Salesforce returned an invalid or missing continuation URL");
    }
    return page.nextRecordsUrl;
  }
}
