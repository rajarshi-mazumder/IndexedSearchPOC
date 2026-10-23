import { Connection, Record as SalesforceRecord } from "jsforce";
import { SforceAuthService } from "./sfAuthService";

export class SalesforceClient {
  private conn: Connection;

  constructor() {
    this.conn = SforceAuthService.createConnection();
  }

  // Recovery compatibility: jsforce requires its Record constraint on T.
  async query<T extends SalesforceRecord = SalesforceRecord>(soql: string): Promise<T[]> {
    const result = await this.conn.query<T>(soql);
    return result.records;
  }

  get connection() {
    return this.conn;
  }
}
