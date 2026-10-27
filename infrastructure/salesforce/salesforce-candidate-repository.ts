import { createHash } from "node:crypto";
import { z } from "zod";
import { CandidateCoreProfile, CandidateProfileAssociation, CandidateProfileRepository } from "../../application/ports/candidate-profile-repository";
import { CandidateTag, CandidateTagCategory } from "../../domain/entities/candidate-enrichment";
import { SalesforceQueryClient } from "./salesforce-query-client";
import { SalesforceCandidateSchema } from "./salesforce-candidate-schema";
import { SalesforceCandidateCoreMapper } from "./mappers/salesforce-candidate-core-mapper";

const idSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/);
const idsSchema = z.array(idSchema);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const optionalContactFields = ["Title", "AccountId", "MailingCity", "MailingState", "MailingCountry", "currentSalary__c",
  "desiredTitle__c", "currentPositionStartDate__c", "positionLevel__c", "jobType__c", "currentMonthlySalary__c",
  "desiredSalary__c", "noticePeriod__c", "location__c", "okToRelocate__c", "relocateTo__c",
  "highestEducationalQualification__c", "highestEducationalInstitute__c", "educationalSpecialization__c",
  "peopleManager__c", "currentPeopleManaged__c", "maxPeopleManaged__c", "status__c", "isDummyCandidate__c"];
const categoryDefaults: Record<string, CandidateTagCategory> = {
  skill: "skills", skills: "skills", skillcode: "skills", skillcategory: "skillCategories",
  system: "systems", systems: "systems", technology: "systems", industry: "industries", subindustry: "subIndustries",
  jobfunction: "jobFunctions", language: "language", languagelevel: "proficiency", proficiency: "proficiency",
};
export interface SalesforceCandidateOptions { recordTypes: string[]; tagTypes: Record<string, CandidateTagCategory> }

export class SalesforceCandidateRepository implements CandidateProfileRepository {
  readonly extractionKey: string;
  private types?: Promise<Map<string, { name: string; object: string }>>;
  constructor(private readonly client: SalesforceQueryClient, private readonly schema: SalesforceCandidateSchema,
    private readonly options: SalesforceCandidateOptions) {
    this.extractionKey = "candidate-enrichment-v2:" + createHash("sha256").update(JSON.stringify({
      recordTypes: [...options.recordTypes].sort(), tagTypes: Object.entries(options.tagTypes).sort(),
    })).digest("hex");
  }
  private recordTypes() {
    return this.types ??= this.client.query("SELECT Id, DeveloperName, SobjectType FROM RecordType WHERE SobjectType IN ('Contact','Tag__c')")
      .then((rows) => new Map(rows.map((row) => [String(row.Id), { name: String(row.DeveloperName), object: String(row.SobjectType) }])));
  }
  private async candidateScope(): Promise<string> {
    const types = await this.recordTypes();
    const ids: string[] = [];
    for (const name of this.options.recordTypes) {
      const matches = [...types].filter(([, type]) => type.object === "Contact" && type.name === name);
      if (!matches.length) throw new Error(`Candidate record type '${name}' not found. Set SF_CANDIDATE_RECORD_TYPES to verified Contact developer names.`);
      ids.push(...matches.map(([id]) => id));
    }
    return `RecordTypeId IN (${this.idList(ids)})`;
  }
  async getBatch(limit: number, afterId?: string): Promise<CandidateCoreProfile[]> {
    z.number().int().min(1).max(1000).parse(limit);
    if (afterId) idSchema.parse(afterId);
    const selection = await this.schema.select("Contact", ["Id", "Name", "RecordTypeId", "LastModifiedDate"], optionalContactFields);
    const where = await this.candidateScope() + (afterId ? ` AND Id > '${afterId}'` : "");
    const rows = await this.client.queryBatch(`SELECT ${selection.fields.join(",")} FROM Contact WHERE ${where} ORDER BY Id ASC LIMIT ${limit}`, limit);
    return this.mapContacts(rows, selection);
  }
  async getByIds(ids: string[]): Promise<CandidateCoreProfile[]> {
    idsSchema.parse(ids);
    if (!ids.length) return [];
    const selection = await this.schema.select("Contact", ["Id", "Name", "RecordTypeId", "LastModifiedDate"], optionalContactFields);
    const rows = await this.selectByIds("Contact", selection.fields, ids, "Id", await this.candidateScope());
    return this.mapContacts(rows, selection);
  }
  private async mapContacts(rows: Record<string, unknown>[], selection: Awaited<ReturnType<SalesforceCandidateSchema["select"]>>): Promise<CandidateCoreProfile[]> {
    const types = await this.recordTypes();
    const references = [...selection.metadata].filter(([, field]) => field.type === "reference").map(([name]) => name);
    const profiles = rows.map((row) => SalesforceCandidateCoreMapper.fromRecord(row, selection.missing, references, types.get(String(row.RecordTypeId))?.name));
    // Resolve optional profile lookup labels in groups, while retaining original IDs.
    const targets = new Map<string, { fields: string[]; ids: Set<string> }>();
    for (const field of references.filter((field) => field.endsWith("__c") && selection.fields.includes(field))) {
      const objects = selection.metadata.get(field)?.referenceTo ?? [];
      if (objects.length !== 1) continue;
      const target = targets.get(objects[0]) ?? { fields: [], ids: new Set<string>() };
      target.fields.push(field);
      for (const profile of profiles) { const id = profile.details[SalesforceCandidateCoreMapper.detailName(field)]; if (typeof id === "string") target.ids.add(id); }
      targets.set(objects[0], target);
    }
    for (const [object, target] of targets) {
      if (!target.ids.size) continue;
      const selected = await this.schema.select(object, ["Id"], ["Name"]);
      if (!selected.fields.includes("Name")) continue;
      const labels = new Map((await this.selectByIds(object, selected.fields, [...target.ids])).map((row) => [String(row.Id), text(row.Name)]));
      for (const profile of profiles) for (const field of target.fields) {
        const name = SalesforceCandidateCoreMapper.detailName(field);
        const label = labels.get(String(profile.details[name]));
        if (!label) continue;
        (profile.resolvedDetails ??= {})[name] = label;
        profile.warnings = profile.warnings.filter((warning) => !warning.startsWith(`Unresolved profile lookup: ${name}=`));
        if (field === "location__c") profile.candidate.location = label;
      }
    }
    return profiles;
  }
  async getAssociations(ids: string[]): Promise<CandidateProfileAssociation[]> {
    const selection = await this.schema.select("TagAssociation__c", ["Id", "candidate__c", "firstTag__c", "secondTag__c", "tagScore__c", "LastModifiedDate"], []);
    return (await this.selectByIds("TagAssociation__c", selection.fields, ids, "candidate__c")).map((row) => ({
      id: idSchema.parse(row.Id), candidateId: idSchema.parse(row.candidate__c), firstTagId: text(row.firstTag__c),
      secondTagId: text(row.secondTag__c), score: number(row.tagScore__c), modifiedAt: text(row.LastModifiedDate),
    }));
  }
  async getTags(ids: string[]): Promise<CandidateTag[]> {
    if (!ids.length) return [];
    const selection = await this.schema.select("Tag__c", ["Id", "Name", "label__c", "RecordTypeId", "tagParent__c"], []);
    const types = await this.recordTypes();
    return (await this.selectByIds("Tag__c", selection.fields, ids)).map((row) => {
      const type = types.get(String(row.RecordTypeId))?.name;
      const category = type ? this.options.tagTypes[type] ?? categoryDefaults[type.toLowerCase().replace(/[^a-z0-9]/g, "")] : undefined;
      return { id: idSchema.parse(row.Id), label: text(row.label__c) ?? text(row.Name), type, category, parentId: text(row.tagParent__c) };
    });
  }
  async getEmployers(ids: string[]) {
    if (!ids.length) return [];
    const selection = await this.schema.select("Account", ["Id", "Name"], ["Industry", "BillingCity", "BillingCountry", "Description", "Website"]);
    return (await this.selectByIds("Account", selection.fields, ids)).map((row) => ({ id: idSchema.parse(row.Id), name: text(row.Name),
      industry: text(row.Industry), city: text(row.BillingCity), country: text(row.BillingCountry), description: text(row.Description), website: text(row.Website) }));
  }
  private idList(ids: string[]): string { return idsSchema.parse(ids).map((id) => `'${id}'`).join(","); }
  private async selectByIds(object: string, fields: string[], ids: string[], key = "Id", scope?: string) {
    const unique = [...new Set(idsSchema.parse(ids))];
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < unique.length; offset += 200) {
      const page = await this.client.query(`SELECT ${fields.join(",")} FROM ${object} WHERE ${key} IN (${this.idList(unique.slice(offset, offset + 200))})${scope ? ` AND ${scope}` : ""} ORDER BY Id ASC`);
      for (const row of page) rows.push(row);
      if (rows.length > 100_000) throw new Error(`Too many ${object} rows for one candidate batch. Retry with a smaller batch size.`);
    }
    return rows;
  }
}
