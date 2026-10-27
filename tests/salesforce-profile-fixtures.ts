import { SalesforceQueryClient } from "../infrastructure/salesforce/salesforce-query-client";
import { SalesforceCandidateRepository } from "../infrastructure/salesforce/salesforce-candidate-repository";
import { SalesforceCandidateSchema } from "../infrastructure/salesforce/salesforce-candidate-schema";
import { CandidateEnrichmentService } from "../application/services/candidate-enrichment-service";
import { CandidateProfileAssembler } from "../application/services/candidate-profile-assembler";

export const candidateRecordType = "012000000000001";
export const systemRecordType = "012000000000002";
export const metadataFields: Record<string, string[]> = {
  Contact: ["Id", "Name", "RecordTypeId", "LastModifiedDate", "Title", "AccountId", "currentSalary__c", "MailingCity", "desiredTitle__c"],
  TagAssociation__c: ["Id", "candidate__c", "firstTag__c", "secondTag__c", "tagScore__c", "LastModifiedDate"],
  Tag__c: ["Id", "Name", "label__c", "RecordTypeId", "tagParent__c"],
  Account: ["Id", "Name", "Industry"],
};
export function profileClient(query: (soql: string) => Promise<Record<string, unknown>[]> = async () => [],
  queryBatch?: (soql: string, limit: number) => Promise<Record<string, unknown>[]>) {
  return {
    describe: async (object: string) => ({ queryable: true, fields: metadataFields[object].map((name) => ({ name, type: "string" })) }),
    query: async (soql: string) => soql.includes("FROM RecordType") ? [
      { Id: candidateRecordType, DeveloperName: "Candidate", SobjectType: "Contact" },
      { Id: systemRecordType, DeveloperName: "Systems", SobjectType: "Tag__c" },
    ] : query(soql),
    queryBatch: queryBatch ?? ((soql: string) => query(soql)),
  } as unknown as SalesforceQueryClient;
}
export function profileRepository(client: SalesforceQueryClient) {
  return new SalesforceCandidateRepository(client, new SalesforceCandidateSchema(client), { recordTypes: ["Candidate"], tagTypes: {} });
}
export function enrichedRepository(client: SalesforceQueryClient) {
  return new CandidateEnrichmentService(profileRepository(client), new CandidateProfileAssembler());
}
