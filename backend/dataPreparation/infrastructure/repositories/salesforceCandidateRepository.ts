import { SalesforceCandidateAssociationMapper } from "../mappers/salesforceCandidateAssociationMapper";
import { SalesforceTagMapper } from "../mappers/salesforceTagMapper";
import { SalesforceEmployerMapper } from "../mappers/salesforceEmployerMapper";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CandidateProfileRepository } from "../../application/ports/candidateProfileRepository";
import { CandidateCoreProfile } from "../../application/models/candidateCoreProfile";
import { CandidateProfileAssociation } from "../../application/models/candidateProfileAssociation";
import { CandidateEnrichment, CandidateTag, CandidateTagCategory } from "../../../../shared/domain/models/candidateEnrichment";
import { SalesforceQueryClient } from "./salesforceQueryClient";
import { SalesforceCandidateSchema, SalesforceFieldSelection } from "./salesforceCandidateSchema";
import { SalesforceCandidateCoreMapper } from "../mappers/salesforceCandidateCoreMapper";

const idSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/);

const idsSchema = z.array(idSchema);

const optionalContactFields = ["Title", "AccountId", "MailingCity", "MailingState", "MailingCountry", "currentSalary__c",
  "desiredTitle__c", "currentPositionStartDate__c", "positionLevel__c", "jobType__c", "currentMonthlySalary__c",
  "desiredSalary__c", "noticePeriod__c", "location__c", "okToRelocate__c", "relocateTo__c",
  "highestEducationalQualification__c", "highestEducationalInstitute__c", "educationalSpecialization__c",
  "peopleManager__c", "currentPeopleManaged__c", "maxPeopleManaged__c", "status__c", "isDummyCandidate__c"];

export interface SalesforceCandidateOptions {
  recordTypes: string[];
  tagTypes: Record<string, CandidateTagCategory>;
}

interface RecordTypeDetails {
  name: string;
  object: string;
}

interface ProfileLookupTarget {
  fields: string[];
  ids: Set<string>;
}

export class SalesforceCandidateRepository implements CandidateProfileRepository {
  public readonly extractionKey: string;

  private types?: Promise<Map<string, RecordTypeDetails>>;

  public constructor(
    private readonly client: SalesforceQueryClient,
    private readonly schema: SalesforceCandidateSchema,
    private readonly options: SalesforceCandidateOptions
  ) {
    this.extractionKey = this.createExtractionKey();
  }

  public async getBatch(limit: number, afterId?: string): Promise<CandidateCoreProfile[]> {
    z.number().int().min(1).max(1000).parse(limit);
    if (afterId) {
      idSchema.parse(afterId);
    }
    const selection = await this.selectContactFields();
    let where = await this.candidateScope();
    if (afterId) {
      where += ` AND Id > '${afterId}'`;
    }
    const query = `SELECT ${selection.fields.join(",")} FROM Contact WHERE ${where} ORDER BY Id ASC LIMIT ${limit}`;
    const rows = await this.client.queryBatch(query, limit);
    return this.mapContactsAndResolveLookups(rows, selection);
  }

  public async getByIds(ids: string[]): Promise<CandidateCoreProfile[]> {
    idsSchema.parse(ids);
    if (ids.length === 0) {
      return [];
    }
    const selection = await this.selectContactFields();
    const scope = await this.candidateScope();
    const rows = await this.selectByIds("Contact", selection.fields, ids, "Id", scope);
    return this.mapContactsAndResolveLookups(rows, selection);
  }

  public async getAssociations(ids: string[]): Promise<CandidateProfileAssociation[]> {
    const selection = await this.schema.select("TagAssociation__c", ["Id", "candidate__c", "firstTag__c", "secondTag__c", "tagScore__c", "LastModifiedDate"], []);
    const rows = await this.selectByIds("TagAssociation__c", selection.fields, ids, "candidate__c");
    const associations: CandidateProfileAssociation[] = [];
    for (const row of rows) {
      associations.push(SalesforceCandidateAssociationMapper.fromRecord(row));
    }
    return associations;
  }

  public async getTags(ids: string[]): Promise<CandidateTag[]> {
    if (ids.length === 0) {
      return [];
    }
    const selection = await this.schema.select("Tag__c", ["Id", "Name", "label__c", "RecordTypeId", "tagParent__c"], []);
    const types = await this.recordTypes();
    const rows = await this.selectByIds("Tag__c", selection.fields, ids);
    const tags: CandidateTag[] = [];
    for (const row of rows) {
      const type = types.get(String(row.RecordTypeId));
      tags.push(SalesforceTagMapper.fromRecord(row, type?.name, this.options.tagTypes));
    }
    return tags;
  }

  public async getEmployers(ids: string[]): Promise<NonNullable<CandidateEnrichment["employer"]>[]> {
    if (ids.length === 0) {
      return [];
    }
    const selection = await this.schema.select("Account", ["Id", "Name"], ["Industry", "BillingCity", "BillingCountry", "Description", "Website"]);
    const rows = await this.selectByIds("Account", selection.fields, ids);
    const employers: NonNullable<CandidateEnrichment["employer"]>[] = [];
    for (const row of rows) {
      employers.push(SalesforceEmployerMapper.fromRecord(row));
    }
    return employers;
  }

  private createExtractionKey(): string {
    const extractionScope = {
      recordTypes: [...this.options.recordTypes].sort(),
      tagTypes: Object.entries(this.options.tagTypes).sort(),
    };
    const scopeJson = JSON.stringify(extractionScope);
    const digest = createHash("sha256").update(scopeJson).digest("hex");
    return "candidate-enrichment-v2:" + digest;
  }

  private recordTypes(): Promise<Map<string, RecordTypeDetails>> {
    if (!this.types) {
      this.types = this.loadRecordTypes();
    }
    return this.types;
  }

  private async loadRecordTypes(): Promise<Map<string, RecordTypeDetails>> {
    const rows = await this.client.query("SELECT Id, DeveloperName, SobjectType FROM RecordType WHERE SobjectType IN ('Contact','Tag__c')");
    const types = new Map<string, RecordTypeDetails>();
    for (const row of rows) {
      types.set(String(row.Id), {
        name: String(row.DeveloperName),
        object: String(row.SobjectType)
      });
    }
    return types;
  }

  private async candidateScope(): Promise<string> {
    const types = await this.recordTypes();
    const ids: string[] = [];
    for (const name of this.options.recordTypes) {
      const matches = this.findContactRecordTypeIds(types, name);
      if (matches.length === 0) {
        throw new Error(`Candidate record type '${name}' not found. Set SF_CANDIDATE_RECORD_TYPES to verified Contact developer names.`);
      }
      ids.push(...matches);
    }
    return `RecordTypeId IN (${this.idList(ids)})`;
  }

  private findContactRecordTypeIds(types: Map<string, RecordTypeDetails>, name: string): string[] {
    const ids: string[] = [];
    for (const [id, type] of types) {
      if (type.object === "Contact" && type.name === name) {
        ids.push(id);
      }
    }
    return ids;
  }

  private selectContactFields(): Promise<SalesforceFieldSelection> {
    return this.schema.select("Contact", ["Id", "Name", "RecordTypeId", "LastModifiedDate"], optionalContactFields);
  }

  private async mapContactsAndResolveLookups(rows: Record<string, unknown>[], selection: SalesforceFieldSelection): Promise<CandidateCoreProfile[]> {
    const types = await this.recordTypes();
    const referenceFields = this.collectReferenceFields(selection);
    const profiles = this.mapContactRecords(rows, selection, referenceFields, types);
    const lookupTargets = this.collectProfileLookupTargets(profiles, referenceFields, selection);
    await this.resolveProfileLookupLabels(profiles, lookupTargets);
    return profiles;
  }

  private collectReferenceFields(selection: SalesforceFieldSelection): string[] {
    const names: string[] = [];
    for (const [name, field] of selection.metadata) {
      if (field.type === "reference") {
        names.push(name);
      }
    }
    return names;
  }

  private mapContactRecords(
    rows: Record<string, unknown>[],
    selection: SalesforceFieldSelection,
    referenceFields: string[],
    types: Map<string, RecordTypeDetails>
  ): CandidateCoreProfile[] {
    const profiles: CandidateCoreProfile[] = [];
    for (const row of rows) {
      const type = types.get(String(row.RecordTypeId));
      const profile = SalesforceCandidateCoreMapper.fromRecord(row, selection.missing, referenceFields, type?.name);
      profiles.push(profile);
    }
    return profiles;
  }

  private collectProfileLookupTargets(
    profiles: CandidateCoreProfile[],
    referenceFields: string[],
    selection: SalesforceFieldSelection
  ): Map<string, ProfileLookupTarget> {
    const targets = new Map<string, ProfileLookupTarget>();
    for (const field of referenceFields) {
      if (!field.endsWith("__c") || !selection.fields.includes(field)) {
        continue;
      }
      const objects = selection.metadata.get(field)?.referenceTo;
      if (!objects || objects.length !== 1) {
        continue;
      }
      let target = targets.get(objects[0]);
      if (!target) {
        target = {
          fields: [],
          ids: new Set<string>()
        };
      }
      target.fields.push(field);
      this.collectProfileLookupIds(profiles, field, target.ids);
      targets.set(objects[0], target);
    }
    return targets;
  }

  private collectProfileLookupIds(profiles: CandidateCoreProfile[], field: string, ids: Set<string>): void {
    const detailName = SalesforceCandidateCoreMapper.detailName(field);
    for (const profile of profiles) {
      const id = profile.details[detailName];
      if (typeof id === "string") {
        ids.add(id);
      }
    }
  }

  private async resolveProfileLookupLabels(profiles: CandidateCoreProfile[], targets: Map<string, ProfileLookupTarget>): Promise<void> {
    for (const [object, target] of targets) {
      if (target.ids.size === 0) {
        continue;
      }
      const selection = await this.schema.select(object, ["Id"], ["Name"]);
      if (!selection.fields.includes("Name")) {
        continue;
      }
      const rows = await this.selectByIds(object, selection.fields, [...target.ids]);
      const labels = this.indexLookupLabels(rows);
      this.applyLookupLabels(profiles, target.fields, labels);
    }
  }

  private indexLookupLabels(rows: Record<string, unknown>[]): Map<string, string | undefined> {
    const labels = new Map<string, string | undefined>();
    for (const row of rows) {
      labels.set(String(row.Id), this.normalizeText(row.Name));
    }
    return labels;
  }

  private applyLookupLabels(
    profiles: CandidateCoreProfile[],
    fields: string[],
    labels: Map<string, string | undefined>
  ): void {
    for (const profile of profiles) {
      for (const field of fields) {
        const name = SalesforceCandidateCoreMapper.detailName(field);
        const label = labels.get(String(profile.details[name]));
        if (!label) {
          continue;
        }
        if (!profile.resolvedDetails) {
          profile.resolvedDetails = {};
        }
        profile.resolvedDetails[name] = label;
        profile.warnings = this.removeResolvedLookupWarning(profile.warnings, name);
        if (field === "location__c") {
          profile.candidate.location = label;
        }
      }
    }
  }

  private removeResolvedLookupWarning(warnings: string[], name: string): string[] {
    const remaining: string[] = [];
    for (const warning of warnings) {
      if (!warning.startsWith(`Unresolved profile lookup: ${name}=`)) {
        remaining.push(warning);
      }
    }
    return remaining;
  }

  private normalizeText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const text = value.trim();
    if (text.length === 0) {
      return undefined;
    }
    return text;
  }

  private idList(ids: string[]): string {
    const validatedIds = idsSchema.parse(ids);
    const quotedIds: string[] = [];
    for (const id of validatedIds) {
      quotedIds.push(`'${id}'`);
    }
    return quotedIds.join(",");
  }

  private async selectByIds(object: string, fields: string[], ids: string[], key = "Id", scope?: string): Promise<Record<string, unknown>[]> {
    const uniqueIds = [...new Set(idsSchema.parse(ids))];
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < uniqueIds.length; offset += 200) {
      const selectedIds = uniqueIds.slice(offset, offset + 200);
      const query = this.buildLookupQuery(object, fields, selectedIds, key, scope);
      const page = await this.client.query(query);
      for (const row of page) {
        rows.push(row);
      }
      if (rows.length > 100000) {
        throw new Error(`Too many ${object} rows for one candidate batch. Retry with a smaller batch size.`);
      }
    }
    return rows;
  }

  private buildLookupQuery(object: string, fields: string[], ids: string[], key: string, scope?: string): string {
    let where = `${key} IN (${this.idList(ids)})`;
    if (scope) {
      where += ` AND ${scope}`;
    }
    return `SELECT ${fields.join(",")} FROM ${object} WHERE ${where} ORDER BY Id ASC`;
  }
}
