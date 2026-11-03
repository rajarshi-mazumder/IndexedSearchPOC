import { DemoCvEmploymentPools } from "../models/demoCvCatalog";

/** Employers are always "Demo <prefix> <suffix>" so they can never be mistaken for real organizations. */
export const demoCvEmploymentPools: DemoCvEmploymentPools = {
  employerPrefixes: [
    "Cedar", "Harbor", "Maple", "Summit", "Orchard", "River", "Aurora", "Birch", "Cobalt", "Coral",
    "Delta", "Ember", "Falcon", "Granite", "Horizon", "Indigo", "Juniper", "Kestrel", "Lagoon", "Meadow",
    "Nimbus", "Onyx", "Pine", "Quartz", "Redwood", "Sakura", "Tidal", "Umber", "Vista", "Willow",
    "Zephyr", "Beacon", "Canyon", "Lantern", "Mosaic", "Northwind", "Pebble", "Sierra", "Tamarind", "Yuzu",
  ],
  employerSuffixes: {
    technology: ["Software", "Digital Labs", "Systems", "Technologies", "Cloud Works", "Interactive", "Data Studio", "Platforms"],
    finance: ["Capital", "Financial Group", "Bank", "Securities", "Insurance", "Asset Management", "Payments", "Accounting Partners"],
    healthcare: ["Medical Center", "Pharma", "Life Sciences", "Health Network", "Clinical Research", "Biotech", "Hospital Group"],
    industrial: ["Manufacturing", "Industries", "Engineering Works", "Logistics", "Electric", "Motors", "Construction", "Materials"],
    consumer: ["Retail", "Brands", "Foods", "Travel", "Media", "Commerce", "Lifestyle", "Entertainment"],
    professional: ["Consulting", "Partners", "Advisory", "Services", "Associates", "Law Office", "Staffing", "Language Services"],
  },
  locations: [
    "Tokyo, Japan", "Osaka, Japan", "Yokohama, Japan", "Nagoya, Japan", "Fukuoka, Japan", "Sapporo, Japan",
    "Kyoto, Japan", "Kobe, Japan", "Sendai, Japan", "Hiroshima, Japan", "Kawasaki, Japan", "Saitama, Japan",
    "Seoul, South Korea", "Busan, South Korea", "Shanghai, China", "Shenzhen, China", "Beijing, China", "Hong Kong",
    "Taipei, Taiwan", "Singapore", "Kuala Lumpur, Malaysia", "Bangkok, Thailand", "Ho Chi Minh City, Vietnam", "Hanoi, Vietnam",
    "Manila, Philippines", "Jakarta, Indonesia", "Bengaluru, India", "Pune, India", "Sydney, Australia", "Melbourne, Australia",
    "London, United Kingdom", "Dublin, Ireland", "Amsterdam, Netherlands", "Berlin, Germany", "Munich, Germany", "Paris, France",
    "Madrid, Spain", "Barcelona, Spain", "Lisbon, Portugal", "Milan, Italy", "Stockholm, Sweden", "Warsaw, Poland",
    "Zurich, Switzerland", "New York, United States", "San Francisco, United States", "Seattle, United States", "Austin, United States",
    "Chicago, United States", "Toronto, Canada", "Vancouver, Canada", "Mexico City, Mexico", "Sao Paulo, Brazil",
  ],
  seniorityLevels: [
    { minimumYears: 0, prefix: "Junior", teamResponsibility: "Supported senior colleagues with preparation, checks and documentation under supervision." },
    { minimumYears: 3, prefix: "", teamResponsibility: "Collaborated with colleagues on reviews, issue resolution and handover." },
    { minimumYears: 7, prefix: "Senior", teamResponsibility: "Mentored colleagues and reviewed work for quality, consistency and risk." },
    { minimumYears: 13, prefix: "Lead", teamResponsibility: "Led a team, set priorities, coached members and coordinated with stakeholders across departments." },
  ],
  projectReviewContributions: [
    "Participated in requirements, validation and delivery reviews.",
    "Presented progress and risks to stakeholders at regular checkpoints.",
    "Documented decisions and handed over operating procedures to the support team.",
    "Coordinated acceptance criteria with business owners and confirmed sign-off.",
    "Tracked issues to closure and shared lessons learned after go-live.",
  ],
};
