import { Candidate } from "../../../domain/entities/candidate";

export class SalesforceCandidateMapper {
  static fromContact(contact: any): Candidate {
    return {
      id: contact.Id,
      name: contact.Name,
      title: contact.Title,
      company: contact.Account?.Name,
      salary: contact.currentSalary__c,
      skills: compact(
        contact.TagConnector__r?.SkillCode1__c,
        contact.TagConnector__r?.SkillCode2__c,
        contact.TagConnector__r?.SkillCode3__c,
      ),
      skillCategories: compact(
        contact.TagConnector__r?.SkillCategory1__c,
        contact.TagConnector__r?.SkillCategory2__c,
        contact.TagConnector__r?.SkillCategory3__c,
      ),
      systems: compact(
        contact.TagConnector__r?.Systems1__c,
        contact.TagConnector__r?.Systems2__c,
        contact.TagConnector__r?.Systems3__c,
      ),
      industries: compact(contact.TagConnector__r?.Industry__c),
      subIndustries: compact(contact.TagConnector__r?.SubIndustry__c),
      jobFunctions: compact(
        contact.TagConnector__r?.JobFunction1__c,
        contact.TagConnector__r?.JobFunction2__c,
        contact.TagConnector__r?.JobFunction3__c,
      ),
      languages: [],
      location: undefined,
    };
  }
}

function compact(...values: (string | null | undefined)[]): string[] {
  return values.filter((v): v is string => !!v && v.trim().length > 0);
}
