import { CandidateReadRepository } from "../../application/ports/candidate-read-repository";
import { CandidateBatchSource } from "../../application/ports/candidate-batch-source";
import { Candidate } from "../../domain/entities/candidate";
import { SalesforceCandidateMapper } from "./mappers/salesforce-candidate-mapper";
import { CONTACT_QUERY, CONTACT_FIELDS } from "./queries/contact";
import { SalesforceQueryClient } from "./salesforce-query-client";
import { z } from "zod";

const contactIdsSchema = z.array(z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/));

export class SalesforceCandidateRepository implements CandidateReadRepository, CandidateBatchSource {
  constructor(private readonly client: SalesforceQueryClient) {}

  async getBatch(limit: number, afterId?: string): Promise<Candidate[]> {
    const options = z.object({ limit: z.number().int().min(1).max(1000),
      afterId: z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/).optional(),
    }).parse({ limit, afterId });
    const where = options.afterId ? `WHERE Id > '${options.afterId}'` : "";
    const query = `SELECT ${CONTACT_FIELDS} FROM Contact ${where} ORDER BY Id ASC LIMIT ${options.limit}`;
    return (await this.client.queryBatch(query, options.limit)).map(SalesforceCandidateMapper.fromContact);
  }

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
