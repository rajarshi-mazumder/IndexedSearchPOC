import assert from "node:assert/strict";
import { test } from "node:test";
import { CandidateEnrichmentService } from "../application/services/candidate-enrichment-service";
import { CandidateProfileAssembler } from "../application/services/candidate-profile-assembler";
import { CandidateCoreProfile, CandidateProfileRepository } from "../application/ports/candidate-profile-repository";
import { CandidateTag } from "../domain/entities/candidate-enrichment";
import { CandidateSnapshotSerializer } from "../infrastructure/json/candidate-snapshot-serializer";
import { CandidateDocumentFactory } from "../application/services/candidate-document-factory";
import { TemplateCandidateProfileGenerator } from "../application/services/template-candidate-profile-generator";
import { OpenSearchCandidateDocumentMapper } from "../infrastructure/opensearch/open-search-candidate-document-mapper";
import { ExportCandidateBatches } from "../application/usecases/export-candidate-batches";
import { CandidateBatchCheckpoint } from "../application/ports/candidate-batch-export-store";
import { candidateFixture } from "./candidate-fixtures";
import { profileClient, profileRepository, metadataFields, candidateRecordType, systemRecordType } from "./salesforce-profile-fixtures";
import { loadSalesforceConfig } from "../infrastructure/config/salesforce-config";
import { SalesforceCandidateRepository } from "../infrastructure/salesforce/salesforce-candidate-repository";
import { SalesforceCandidateSchema } from "../infrastructure/salesforce/salesforce-candidate-schema";

const core: CandidateCoreProfile = { candidate: candidateFixture({ id: "003000000000001", title: "Developer", skills: [], systems: [], languages: [] }),
  accountId: "001000000000001", details: { desiredTitle: "Senior developer", currentSalary: 6000000 }, warnings: [], modifiedAt: "2026-10-27T00:00:00.000Z" };

function source(overrides: Partial<CandidateProfileRepository> = {}): CandidateProfileRepository {
  return { extractionKey: "enriched-v2", getBatch: async () => [core], getByIds: async () => [core],
    getAssociations: async () => [], getTags: async () => [], getEmployers: async () => [], ...overrides };
}

test("all associations, second tags, language pairs and recursive parents survive export and search document round trips", async () => {
  const tagCalls: string[][] = [];
  const tags: CandidateTag[] = [
    ...Array.from({ length: 5 }, (_, index): CandidateTag => ({ id: `skill${index}`, label: `Skill ${index}`, category: "skills", type: "SkillCode" })),
    { id: "java", label: "Java", category: "systems", type: "Systems", parentId: "technology" },
    { id: "technology", label: "Information Technology", category: "skillCategories", parentId: "root" },
    { id: "root", label: "Engineering", category: "skillCategories" },
    { id: "japanese", label: "Japanese", category: "language" },
    { id: "business", label: "Business level", category: "proficiency" },
  ];
  const associations = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `association${index}`, candidateId: core.candidate.id, firstTagId: `skill${index}`, score: index })),
    { id: "association-java", candidateId: core.candidate.id, firstTagId: "skill0", secondTagId: "java", score: 4 },
    { id: "association-language", candidateId: core.candidate.id, firstTagId: "japanese", secondTagId: "business" },
  ];
  const repository = source({ getAssociations: async () => associations, getTags: async (ids) => {
    tagCalls.push(ids); return tags.filter((tag) => ids.includes(tag.id));
  }, getEmployers: async () => [{ id: core.accountId!, name: "Example Employer" }] });
  const events: string[] = [];
  const [candidate] = await new CandidateEnrichmentService(repository, new CandidateProfileAssembler()).getBatch(1000, undefined, (message) => events.push(message));
  assert.equal(candidate.skills.length, 5);
  assert.deepEqual(candidate.systems, ["Java"]);
  assert.deepEqual(candidate.languages, [{ code: "Japanese", level: "Business level" }]);
  assert.deepEqual(candidate.skillCategories.slice(-2), ["Information Technology", "Engineering"]);
  assert.equal(candidate.company, "Example Employer");
  assert.equal(candidate.enrichment!.associations.length, 7);
  assert.equal(candidate.enrichment!.associations[5].score, 4);
  assert.equal(tagCalls.length, 3);
  assert.equal(new Set(tagCalls.flat()).size, tagCalls.flat().length, "Shared tags must be fetched once per batch");
  assert.ok(events.some((message) => message.includes("7 associations")));
  const json = CandidateSnapshotSerializer.serialize([candidate], new Date());
  const [restored] = CandidateSnapshotSerializer.deserialize(json);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(candidate)));
  const document = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator()).create(restored);
  assert.ok(document);
  assert.match(document.searchText, /Systems and technologies: Java/);
  assert.match(document.searchText, /Desired role: Senior developer/);
  assert.doesNotMatch(document.searchText, /6000000|Example Employer|association-java/);
  const output = OpenSearchCandidateDocumentMapper.fromDocument(OpenSearchCandidateDocumentMapper.toDocument(document));
  assert.deepEqual(output.candidate.enrichment, restored.enrichment);
});

test("unknown types, missing tags, cycles and missing employers stay visible without fabricating expertise", async () => {
  const candidate = new CandidateProfileAssembler().assemble(core, [
    { id: "link1", candidateId: core.candidate.id, firstTagId: "a", secondTagId: "missing" },
  ], new Map([ ["a", { id: "a", label: "Unverified", type: "UnmappedType", parentId: "b" }],
    ["b", { id: "b", label: "Other", parentId: "a" }] ]));
  assert.equal(candidate.skills.length, 0);
  assert.ok(candidate.enrichment!.warnings.some((warning) => warning.includes("cycle")));
  assert.ok(candidate.enrichment!.warnings.some((warning) => warning.includes("Unclassified")));
  assert.ok(candidate.enrichment!.warnings.some((warning) => warning.includes("Unresolved tag: missing")));
  assert.ok(candidate.enrichment!.warnings.some((warning) => warning.includes("Unresolved employer")));
});

test("an association failure prevents file commits and checkpoint advancement", async () => {
  let checkpoint: CandidateBatchCheckpoint | undefined;
  let saves = 0;
  const service = new CandidateEnrichmentService(source({ getAssociations: async () => { throw new Error("relationship unavailable"); } }), new CandidateProfileAssembler());
  const exporter = new ExportCandidateBatches(service, { withLock: (operation) => operation(), loadCheckpoint: async () => checkpoint,
    saveCheckpoint: async (value) => { checkpoint = value; }, saveBatch: async () => { saves++; return "file"; } });
  await assert.rejects(exporter.execute({ org: "full", sourceId: "org", batchSize: 1000, maxBatches: 1, resume: false }), /relationship unavailable/);
  assert.equal(saves, 0);
  assert.equal(checkpoint!.fetched, 0);
});

test("legacy and changed-scope checkpoints cannot resume with the enriched extractor", async () => {
  for (const key of [undefined, "other-record-types"]) {
    const checkpoint: CandidateBatchCheckpoint = { version: 1, extractionKey: key, org: "full", sourceId: "org", batchSize: 1000, batchNumber: 0, fetched: 0, complete: false };
    const exporter = new ExportCandidateBatches({ extractionKey: "enriched-v2", getBatch: async () => { throw new Error("Should not query"); } }, {
      withLock: (operation) => operation(), loadCheckpoint: async () => checkpoint, saveBatch: async () => "file", saveCheckpoint: async () => {},
    });
    await assert.rejects(exporter.execute({ org: "full", sourceId: "org", batchSize: 1000, maxBatches: 1, resume: true }), /Extraction version or scope changed/);
  }
  assert.equal(CandidateSnapshotSerializer.deserialize(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), candidates: [candidateFixture()] })).length, 1);
});

test("schema discovery selects only available optional fields and preserves missing-field diagnostics", async () => {
  const queries: string[] = [];
  const repository = profileRepository(profileClient(async (query) => {
    queries.push(query); return [{ Id: core.candidate.id, Name: "Candidate", RecordTypeId: candidateRecordType, MailingCity: "Tokyo", currentSalary__c: 0 }];
  }));
  const [result] = await repository.getByIds([core.candidate.id]);
  assert.equal(result.candidate.location, "Tokyo");
  assert.equal(result.candidate.salary, 0);
  assert.match(queries[0], /RecordTypeId IN/);
  assert.doesNotMatch(queries[0], /highestEducationalInstitute__c/);
  assert.ok(result.warnings.some((warning) => warning.includes("highestEducationalInstitute__c")));
});

test("required relationship fields fail preflight; unknown record types do not broaden to all Contacts", async () => {
  const client = profileClient();
  client.describe = async (object) => ({ queryable: true, fields: (metadataFields[object] ?? []).filter((name) => name !== "secondTag__c").map((name) => ({ name, type: "string" })) });
  await assert.rejects(profileRepository(client).getAssociations([core.candidate.id]), /Required Salesforce field unavailable.*secondTag/);
  client.query = async () => [];
  await assert.rejects(profileRepository(client).getBatch(1000), /Candidate record type/);
});

test("explicit tag category mapping and record-type scope are validated and fingerprinted", async () => {
  const config = loadSalesforceConfig({ SF_TARGET_ORG: "full", SF_CANDIDATE_RECORD_TYPES: "Candidate", SF_TAG_TYPE_MAP: '{"Systems":"skills"}' });
  assert.deepEqual(config.SF_TAG_TYPE_MAP, { Systems: "skills" });
  assert.throws(() => loadSalesforceConfig({ SF_TARGET_ORG: "full", SF_TAG_TYPE_MAP: '{"Custom":"anything"}' }));
  const repository = profileRepository(profileClient(async () => [{ Id: "a02000000000001", Name: "Generated name", label__c: "Java", RecordTypeId: systemRecordType }]));
  const [tag] = await repository.getTags(["a02000000000001"]);
  assert.equal(tag.label, "Java"); assert.equal(tag.category, "systems");
  const client = profileClient(async () => [{ Id: "a02000000000001", label__c: "Java", RecordTypeId: systemRecordType }]);
  const override = new SalesforceCandidateRepository(client, new SalesforceCandidateSchema(client), { recordTypes: ["Candidate"], tagTypes: config.SF_TAG_TYPE_MAP });
  assert.equal((await override.getTags(["a02000000000001"]))[0].category, "skills");
  assert.notEqual(override.extractionKey, repository.extractionKey);
});

test("shared profile lookups resolve names in a batch while preserving original reference IDs", async () => {
  const queries: string[] = [];
  const institute = "a03000000000001";
  const client = profileClient(async (query) => {
    queries.push(query);
    if (query.includes("FROM Institute__c")) return [{ Id: institute, Name: "Engineering Institute" }];
    return [1, 2].map((number) => ({ Id: "00300000000000" + number, Name: "Candidate " + number,
      RecordTypeId: candidateRecordType, highestEducationalInstitute__c: institute }));
  });
  const describe = client.describe.bind(client);
  client.describe = async (object) => object === "Institute__c" ? { queryable: true, fields: [{ name: "Id", type: "id" }, { name: "Name", type: "string" }] }
    : object === "Contact" ? { queryable: true, fields: [...(await describe(object)).fields,
      { name: "highestEducationalInstitute__c", type: "reference", referenceTo: ["Institute__c"] }] } : describe(object);
  const result = await profileRepository(client).getByIds(["003000000000001", "003000000000002"]);
  assert.equal(queries.filter((query) => query.includes("FROM Institute__c")).length, 1);
  assert.equal(result[0].details.highestEducationalInstitute, institute);
  assert.equal(result[0].resolvedDetails!.highestEducationalInstitute, "Engineering Institute");
  assert.ok(!result[0].warnings.some((warning) => warning.includes("Unresolved profile lookup")));
});

test("JavaScript labels are not rewritten into Java expertise", () => {
  const candidate = new CandidateProfileAssembler().assemble(core, [{ id: "a", candidateId: core.candidate.id, firstTagId: "js" }],
    new Map([["js", { id: "js", category: "systems", label: "JavaScript" }]]));
  assert.deepEqual(candidate.systems, ["JavaScript"]);
  assert.equal(candidate.systems.includes("Java"), false);
});
