import { CandidateReadRepository } from "../../application/ports/CandidateRepository";
import { Candidate } from "../../domain/entities/Candidate";
import { CandidateMapper } from "./mappers/CandidateMapper";
import { CONTACT_QUERY, CONTACT_FIELDS } from "./queries/contact";
import { SalesforceClient } from "./SalesforceClient";

export class SalesforceCandidateRepository implements CandidateReadRepository {
  constructor(private readonly client: SalesforceClient) {}

  async getAll(): Promise<Candidate[]> {
    const contacts = await this.client.query(CONTACT_QUERY);
    return contacts.map(CandidateMapper.fromContact);
  }

  async getByIds(ids: string[]): Promise<Candidate[]> {
    if (ids.length === 0) {
      return [];
    }
    const formattedIds = ids.map((id) => `'${id}'`).join(",");
    const query = `
      SELECT ${CONTACT_FIELDS}
      FROM Contact
      WHERE Id IN (${formattedIds})
    `;
    const contacts = await this.client.query(query);
    return contacts.map(CandidateMapper.fromContact);
  }

  async getChangedSince(date: Date): Promise<Candidate[]> {
    throw new Error("Not implemented");
  }
}
