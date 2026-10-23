export const CONTACT_FIELDS = `
  Id,
  Name,
  Current_Position__c,
  Current_Company__c,
  Current_Salary__c,

  TagConnector__r.SkillCode1__c,
  TagConnector__r.SkillCode2__c,
  TagConnector__r.SkillCode3__c,

  TagConnector__r.SkillCategory1__c,
  TagConnector__r.SkillCategory2__c,
  TagConnector__r.SkillCategory3__c,

  TagConnector__r.Systems1__c,
  TagConnector__r.Systems2__c,
  TagConnector__r.Systems3__c,

  TagConnector__r.Industry__c,
  TagConnector__r.SubIndustry__c,

  TagConnector__r.JobFunction1__c,
  TagConnector__r.JobFunction2__c,
  TagConnector__r.JobFunction3__c,

  TagConnector__r.ENLevel__c,
  TagConnector__r.JPLevel__c,
  TagConnector__r.CNLevel__c
`;

export const CONTACT_QUERY = `
  SELECT ${CONTACT_FIELDS}
  FROM Contact
`;
