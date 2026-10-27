import { Connection, Record as SalesforceRecord } from "jsforce";
import { z } from "zod";

const pageSchema = z.object({
  done: z.boolean(), records: z.array(z.record(z.string(), z.unknown())), nextRecordsUrl: z.string().optional(),
}).refine((page) => page.done || page.records.length > 0, "Salesforce returned an empty unfinished page");

export class SalesforceQueryClient {
  constructor(private readonly connection: Connection) {}

  async queryBatch(soql: string, limit: number): Promise<SalesforceRecord[]> {
    z.number().int().min(1).max(1000).parse(limit);
    let url = `/services/data/v${this.connection.version}/query?q=${encodeURIComponent(soql)}`;
    const records: SalesforceRecord[] = [];
    const visited = new Set<string>();
    for (;;) {
      if (visited.has(url)) throw new Error("Salesforce repeated a continuation URL");
      visited.add(url);
      // A LIMIT query can still span multiple REST pages. Bound each request's
      // wait and the entire result independently of Salesforce's page size.
      const page = pageSchema.parse(await this.connection.request({ method: "GET", url }, { timeout: 120_000 }));
      if (records.length + page.records.length > limit) throw new Error("Salesforce exceeded the requested batch limit");
      records.push(...page.records);
      if (page.done) return records;
      if (!page.nextRecordsUrl || !/^\/services\/data\/v[\d.]+\/query\/[a-zA-Z0-9-]+$/.test(page.nextRecordsUrl)) {
        throw new Error("Salesforce returned an invalid or missing continuation URL");
      }
      url = page.nextRecordsUrl;
    }
  }

  async query<T extends SalesforceRecord = SalesforceRecord>(soql: string): Promise<T[]> {
    let page = await this.connection.query<T>(soql);
    const records = [...page.records];
    while (!page.done) {
      if (!page.nextRecordsUrl) throw new Error("Salesforce returned an incomplete page without a continuation URL");
      page = await this.connection.queryMore<T>(page.nextRecordsUrl);
      records.push(...page.records);
    }
    return records;
  }
}
