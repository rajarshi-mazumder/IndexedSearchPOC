import { CandidateReadRepository } from "../../application/ports/candidate-read-repository";
import { Candidate } from "../../domain/entities/candidate";
import { SalesforceCandidateMapper } from "./mappers/salesforce-candidate-mapper";
import { CONTACT_QUERY, CONTACT_FIELDS } from "./queries/contact";
import { SalesforceQueryClient } from "./salesforce-query-client";
import { z } from "zod";

const contactIdsSchema = z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/));

export class SalesforceCandidateRepository implements CandidateReadRepository {
  constructor(private readonly client: SalesforceQueryClient) {}

  async getAll(): Promise<Candidate[]> {
    const contacts = await this.client.query(CONTACT_QUERY);
    return contacts.map(SalesforceCandidateMapper.fromContact);
  }

  async getByIds(ids: string[]): Promise<Candidate[]> {
    if (ids.length === 0) {
      return [];
    }
    const validatedIds = [...new Set(contactIdsSchema.parse(ids))];
    const candidates: Candidate[] = [];
    for (let offset = 0; offset < validatedIds.length; offset += 200) {
      const formattedIds = validatedIds.slice(offset, offset + 200).map((id) => `'${id}'`).join(",");
      const query = `SELECT ${CONTACT_FIELDS} FROM Contact WHERE Id IN (${formattedIds})`;
      const contacts = await this.client.query(query);
      candidates.push(...contacts.map(SalesforceCandidateMapper.fromContact));
    }
    return candidates;
  }

}
