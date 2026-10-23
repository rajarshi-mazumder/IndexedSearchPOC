import { CandidateDocument } from "../../domain/entities/CandidateDocument";

export class OpenSearchDocumentMapper {
  static toDocument(document: CandidateDocument) {
    return {
      salesforceId: document.salesforceId,
      name: document.candidate.name,
      title: document.candidate.title,
      company: document.candidate.company,
      location: document.candidate.location,
      salary: document.candidate.salary,
      skills: document.candidate.skills,
      skillCategories: document.candidate.skillCategories,
      systems: document.candidate.systems,
      industries: document.candidate.industries,
      subIndustries: document.candidate.subIndustries,
      jobFunctions: document.candidate.jobFunctions,
      languages: document.candidate.languages,
      profile: document.profile,
      embedding: document.embedding,
      indexedAt: document.indexedAt.toISOString(),
    };
  }

  static fromDocument(document: any): CandidateDocument {
    return {
      salesforceId: document.salesforceId,
      profile: document.profile,
      embedding: document.embedding,
      candidate: {
        id: document.salesforceId,
        name: document.name,
        title: document.title,
        company: document.company,
        location: document.location,
        salary: document.salary,
        skills: document.skills ?? [],
        skillCategories: document.skillCategories ?? [],
        systems: document.systems ?? [],
        industries: document.industries ?? [],
        subIndustries: document.subIndustries ?? [],
        jobFunctions: document.jobFunctions ?? [],
        languages: document.languages ?? [],
      },
      indexedAt: new Date(document.indexedAt),
    };
  }
}
