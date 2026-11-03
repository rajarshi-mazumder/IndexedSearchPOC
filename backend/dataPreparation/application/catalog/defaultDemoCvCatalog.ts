import { DemoCvCatalog } from "../models/demoCvCatalog";
import { commercialDemoCvArchetypes } from "./commercialDemoCvArchetypes";
import { dataAndAnalyticsDemoCvArchetypes } from "./dataAndAnalyticsDemoCvArchetypes";
import { deliveryAndDesignDemoCvArchetypes } from "./deliveryAndDesignDemoCvArchetypes";
import { demoCvCredentialPools } from "./demoCvCredentialPools";
import { demoCvEmploymentPools } from "./demoCvEmploymentPools";
import { demoCvSpokenLanguagePools } from "./demoCvSpokenLanguagePools";
import { demoCvSummaryTemplates } from "./demoCvSummaryTemplates";
import { enterpriseApplicationDemoCvArchetypes } from "./enterpriseApplicationDemoCvArchetypes";
import { financeAndLegalDemoCvArchetypes } from "./financeAndLegalDemoCvArchetypes";
import { healthcareAndLifeSciencesDemoCvArchetypes } from "./healthcareAndLifeSciencesDemoCvArchetypes";
import { industrialAndSupplyChainDemoCvArchetypes } from "./industrialAndSupplyChainDemoCvArchetypes";
import { infrastructureAndSecurityDemoCvArchetypes } from "./infrastructureAndSecurityDemoCvArchetypes";
import { peopleAndLanguageServicesDemoCvArchetypes } from "./peopleAndLanguageServicesDemoCvArchetypes";
import { softwareEngineeringDemoCvArchetypes } from "./softwareEngineeringDemoCvArchetypes";

/**
 * The synthetic CV catalog used by the console. Content and archetype order are part of the generator version:
 * selection indexes into this list, so any change here alters generated CVs and needs a generator version bump.
 */
export const defaultDemoCvCatalog: DemoCvCatalog = {
  archetypes: [
    ...softwareEngineeringDemoCvArchetypes,
    ...infrastructureAndSecurityDemoCvArchetypes,
    ...dataAndAnalyticsDemoCvArchetypes,
    ...enterpriseApplicationDemoCvArchetypes,
    ...financeAndLegalDemoCvArchetypes,
    ...commercialDemoCvArchetypes,
    ...peopleAndLanguageServicesDemoCvArchetypes,
    ...deliveryAndDesignDemoCvArchetypes,
    ...industrialAndSupplyChainDemoCvArchetypes,
    ...healthcareAndLifeSciencesDemoCvArchetypes,
  ],
  employment: demoCvEmploymentPools,
  credentials: demoCvCredentialPools,
  spokenLanguages: demoCvSpokenLanguagePools,
  summaryTemplates: demoCvSummaryTemplates,
};
