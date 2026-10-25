import { Connection, Record as SalesforceRecord } from "jsforce";

export class SalesforceQueryClient {
  constructor(private readonly connection: Connection) {}

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
