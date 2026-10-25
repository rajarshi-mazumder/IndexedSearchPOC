// Fixed before the first 100-candidate benchmark run. Do not rewrite queries or
// expected IDs to make a failing search pass. Validation cases are reserved.
export interface CandidateSearchBenchmarkCase {
  id: string;
  query: string;
  expectedId: string;
  split: "development" | "validation";
}

export const CANDIDATE_SEARCH_BENCHMARK_CASES: readonly CandidateSearchBenchmarkCase[] = [
  { id: "dev-01", split: "development", expectedId: "demo-site-reliability", query: "an engineer who keeps production services running, monitors outages, and restores availability" },
  { id: "dev-02", split: "development", expectedId: "demo-react-frontend", query: "build accessible web interfaces using React and TypeScript" },
  { id: "dev-03", split: "development", expectedId: "demo-financial-analyst", query: "prepare company budgets, forecast financial performance, and value the business" },
  { id: "dev-04", split: "development", expectedId: "demo-pediatrician", query: "a doctor to examine infants, check childhood development, and give children their immunizations" },
  { id: "dev-05", split: "development", expectedId: "demo-pharmacist", query: "check prescriptions for unsafe combinations of medicines and explain the correct dose to patients" },
  { id: "dev-06", split: "development", expectedId: "demo-physiotherapist", query: "help an injured athlete regain movement through rehabilitation exercises and hands-on treatment" },
  { id: "dev-07", split: "development", expectedId: "demo-special-education-teacher", query: "adapt classroom instruction for children with learning disabilities and create individual learning plans" },
  { id: "dev-08", split: "development", expectedId: "demo-instructional-designer", query: "turn employee training material into interactive online courses with clear learning objectives" },
  { id: "dev-09", split: "development", expectedId: "demo-structural-engineer", query: "calculate loads and design reinforced concrete buildings to withstand earthquakes" },
  { id: "dev-10", split: "development", expectedId: "demo-solar-engineer", query: "design photovoltaic installations and estimate their electricity production using PVsyst" },
  { id: "dev-11", split: "development", expectedId: "demo-plumber", query: "repair a leaking water pipe and clear a blocked drain in a building" },
  { id: "dev-12", split: "development", expectedId: "demo-patent-attorney", query: "protect a new invention by researching prior art and preparing a patent application" },
  { id: "dev-13", split: "development", expectedId: "demo-actuary", query: "calculate life insurance premiums and estimate the reserves needed for future claims" },
  { id: "dev-14", split: "development", expectedId: "demo-seo-specialist", query: "improve unpaid visibility on Google by auditing website crawl issues and researching search keywords" },
  { id: "dev-15", split: "development", expectedId: "demo-pastry-chef", query: "make croissants, chocolate desserts, and plated sweets for a bakery" },
  { id: "dev-16", split: "development", expectedId: "demo-agronomist", query: "advise farmers on soil fertility, crop pests, and irrigation to increase harvest yields" },
  { id: "dev-17", split: "development", expectedId: "demo-marine-biologist", query: "study ocean ecosystems and survey coral reefs to support marine conservation" },
  { id: "dev-18", split: "development", expectedId: "demo-translator", query: "translate technical documents between Japanese and English using terminology databases" },
  { id: "dev-19", split: "development", expectedId: "demo-video-editor", query: "assemble filmed footage, correct its colors, and add motion graphics in post production" },
  { id: "dev-20", split: "development", expectedId: "demo-clinical-psychologist", query: "provide cognitive behavioral therapy and psychological assessment for people coping with trauma" },
  { id: "val-01", split: "validation", expectedId: "demo-data-engineer", query: "build pipelines that move retail data into a warehouse with Airflow and Spark" },
  { id: "val-02", split: "validation", expectedId: "demo-cybersecurity", query: "investigate suspicious security alerts and hunt for attacks using Splunk" },
  { id: "val-03", split: "validation", expectedId: "demo-icu-nurse", query: "care for critically ill patients at the bedside and manage their ventilators" },
  { id: "val-04", split: "validation", expectedId: "demo-radiologist", query: "interpret MRI and CT scans and report the medical findings" },
  { id: "val-05", split: "validation", expectedId: "demo-veterinarian", query: "diagnose sick pets, perform surgery on animals, and advise their owners" },
  { id: "val-06", split: "validation", expectedId: "demo-mathematics-teacher", query: "teach teenagers algebra, geometry, and calculus and prepare them for examinations" },
  { id: "val-07", split: "validation", expectedId: "demo-electrical-power-engineer", query: "design electrical substations and coordinate protective relays on the power grid" },
  { id: "val-08", split: "validation", expectedId: "demo-environmental-engineer", query: "design systems that clean wastewater and monitor water pollution" },
  { id: "val-09", split: "validation", expectedId: "demo-hvac-technician", query: "service heat pumps and repair air conditioning and refrigeration equipment" },
  { id: "val-10", split: "validation", expectedId: "demo-cnc-machinist", query: "program CNC lathes and milling machines to make precision metal components" },
  { id: "val-11", split: "validation", expectedId: "demo-external-auditor", query: "independently examine company financial statements and test accounting controls under IFRS" },
  { id: "val-12", split: "validation", expectedId: "demo-credit-risk-analyst", query: "assess whether commercial borrowers will repay loans and model their probability of default" },
  { id: "val-13", split: "validation", expectedId: "demo-procurement-manager", query: "select industrial suppliers and negotiate purchase agreements using SAP Ariba" },
  { id: "val-14", split: "validation", expectedId: "demo-customer-success", query: "help SaaS customers adopt a product, renew their subscriptions, and avoid cancellation" },
  { id: "val-15", split: "validation", expectedId: "demo-hotel-manager", query: "run hotel guest services, coordinate housekeeping, and manage room revenue" },
  { id: "val-16", split: "validation", expectedId: "demo-warehouse-manager", query: "supervise a distribution center, improve order picking, and control warehouse stock" },
  { id: "val-17", split: "validation", expectedId: "demo-clinical-research", query: "coordinate clinical trial participants, obtain informed consent, and maintain study records" },
  { id: "val-18", split: "validation", expectedId: "demo-social-worker", query: "support vulnerable families through casework, safeguarding, and community referrals" },
  { id: "val-19", split: "validation", expectedId: "demo-sound-engineer", query: "record musicians, mix their tracks, and master the audio in Pro Tools" },
  { id: "val-20", split: "validation", expectedId: "demo-occupational-therapist", query: "help people regain independence in daily activities by assessing their needs and providing adaptive equipment" },
];
