import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvProfile } from "../../../../shared/domain/models/candidateCvProfile";
import { CandidateCvGenerator } from "../ports/candidateCvGenerator";

interface CvArchetype {
  name: string;
  match: RegExp;
  role: string;
  degree: string;
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  projects: {
    name: string;
    description: string;
    contribution: string;
  }[];
}

const archetypes: CvArchetype[] = [
  {
    name: "java-backend",
    match: /\b(java|j2ee|spring)\b/i,
    role: "Backend Engineer",
    degree: "Computer Science",
    languages: ["Java", "SQL"],
    frameworks: ["Spring Boot", "JUnit"],
    databases: ["PostgreSQL"],
    tools: ["Kafka", "Docker", "Git"],
    projects: [
      {
        name: "Payment reconciliation",
        description: "Banking services matching payment events with settlement records.",
        contribution: "Built Java REST APIs and Kafka consumers with idempotent processing and automated integration tests."
      },
      {
        name: "Order management",
        description: "Inventory reservation and order tracking for a retail platform.",
        contribution: "Implemented Spring Boot services, SQL query tuning and failure recovery for stock updates."
      },
      {
        name: "Employee workflow",
        description: "Approval workflows for recruitment and timesheet submissions.",
        contribution: "Designed relational tables, documented REST contracts and delivered unit tests and production fixes."
      }
    ]
  },
  {
    name: "frontend",
    match: /\b(javascript|typescript|react|angular|frontend|front.end)\b/i,
    role: "Frontend Engineer",
    degree: "Software Engineering",
    languages: ["TypeScript", "JavaScript", "HTML", "CSS"],
    frameworks: ["Angular", "RxJS"],
    databases: [],
    tools: ["Playwright", "Git", "Figma"],
    projects: [
      {
        name: "Customer self-service portal",
        description: "Accessible browser workflows for account servicing.",
        contribution: "Built responsive forms and tables, integrated REST APIs and tested keyboard navigation."
      },
      {
        name: "Operations dashboard",
        description: "Interactive monitoring of service queues and workload.",
        contribution: "Implemented reusable UI components, chart filtering and browser performance improvements."
      }
    ]
  },
  {
    name: "data-engineering",
    match: /\b(python|etl|spark|data engineer)\b/i,
    role: "Data Engineer",
    degree: "Computer Science",
    languages: ["Python", "SQL"],
    frameworks: ["Apache Spark"],
    databases: ["Snowflake", "PostgreSQL"],
    tools: ["AWS S3", "AWS Athena", "Airflow"],
    projects: [
      {
        name: "Warehouse ingestion",
        description: "Daily ingestion of operational data into an analytics warehouse.",
        contribution: "Created incremental ETL pipelines, schema checks and retryable jobs with lineage tracking."
      },
      {
        name: "Event data lake",
        description: "Partitioned event storage for customer activity reporting.",
        contribution: "Optimized SQL transformations, file partitioning and scheduled data quality checks."
      }
    ]
  },
  {
    name: "analytics",
    match: /\b(analyst|analytics|qlik|tableau|power bi)\b/i,
    role: "Business Intelligence Analyst",
    degree: "Statistics",
    languages: ["SQL"],
    frameworks: [],
    databases: ["SQL Server"],
    tools: ["Qlik Sense", "Power BI", "Excel"],
    projects: [
      {
        name: "Revenue reporting",
        description: "Shared business metrics for regional sales teams.",
        contribution: "Defined KPIs, reconciled source data and designed dashboards with drill-down analysis."
      },
      {
        name: "Service demand forecasting",
        description: "Workload forecasts for support planning.",
        contribution: "Analyzed trends, validated assumptions and presented actionable forecasts to stakeholders."
      }
    ]
  },
  {
    name: "finance",
    match: /\b(finance|accountant|accounting|audit)\b/i,
    role: "Financial Analyst",
    degree: "Accounting",
    languages: [],
    frameworks: [],
    databases: [],
    tools: ["Excel", "SAP", "Financial modelling"],
    projects: [
      {
        name: "Budget planning",
        description: "Annual budgets and rolling forecasts across business units.",
        contribution: "Built financial models, investigated cost variances and supported management reviews."
      },
      {
        name: "Close process improvement",
        description: "Monthly reconciliation and financial reporting controls.",
        contribution: "Documented controls, reconciled ledger balances and streamlined approval schedules."
      }
    ]
  },
  {
    name: "operations",
    match: /\b(operations|logistics|supply chain|procurement)\b/i,
    role: "Operations Specialist",
    degree: "Business Administration",
    languages: [],
    frameworks: [],
    databases: [],
    tools: ["Excel", "ERP", "Process mapping"],
    projects: [
      {
        name: "Inventory planning",
        description: "Stock replenishment and supplier delivery coordination.",
        contribution: "Analyzed demand, adjusted reorder points and tracked delivery exceptions."
      },
      {
        name: "Process standardization",
        description: "Consistent order fulfilment procedures across teams.",
        contribution: "Mapped workflows, introduced operating checklists and monitored service-level performance."
      }
    ]
  },
  {
    name: "cloud-platform",
    match: /\b(devops|cloud|infrastructure|platform|kubernetes)\b/i,
    role: "Platform Engineer",
    degree: "Information Technology",
    languages: ["Python", "Bash"],
    frameworks: [],
    databases: ["Redis"],
    tools: ["AWS", "Terraform", "Kubernetes", "Prometheus"],
    projects: [
      {
        name: "Deployment automation",
        description: "Repeatable application releases across test and production environments.",
        contribution: "Created infrastructure modules, delivery pipelines and rollback procedures."
      },
      {
        name: "Service reliability",
        description: "Monitoring and recovery practices for customer-facing systems.",
        contribution: "Defined alerts, tested recovery drills and reduced recurring incidents through root cause analysis."
      }
    ]
  },
];

/** Pure templates: no credentials, network calls, clock dependence or per-record I/O. */
export class GenerateDemoCvForCandidateService implements CandidateCvGenerator {
  public generate(candidate: Candidate, seed: string): CandidateCvProfile {
    const hash = this.hashCandidateAndSeed(candidate.id, seed);
    const type = this.selectArchetype(candidate, hash);
    const years = 4 + hash % 9;
    const role = this.describeRole(type, years);
    const projects = this.selectProjects(type, hash);
    const technicalSkills = this.copyTechnicalSkills(type);
    return {
      source: {
        kind: "synthetic",
        generatorVersion: 1,
        seed,
        archetype: type.name
      },
      summary: `${role} with ${years} years of experience. Focus on ${projects[0].name.toLowerCase()} and ${projects[1].name.toLowerCase()}, with responsibility for delivery, documentation and cross-team collaboration.`,
      technicalSkills,
      employmentHistory: this.createEmploymentHistory(type, projects, hash, years, role),
      projects: this.createProjectDetails(projects, technicalSkills, role),
      education: [{
        qualification: `Bachelor of ${type.degree}`,
        institution: "Demo Institute of Applied Studies",
        graduationYear: 2026 - years
      }],
      certifications: [{
        name: `${type.role} professional training`,
        issuer: "Demo Learning Academy",
        year: 2024
      }],
      languages: this.createLanguages(hash),
    };
  }

  private hashCandidateAndSeed(candidateId: string, seed: string): number {
    const key = `${seed}:${candidateId}:v1`;
    let hash = 2166136261;
    for (const character of key) {
      // Preserve the established FNV-1a seed so existing demo CVs stay identical.
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    return hash;
  }

  private selectArchetype(candidate: Candidate, hash: number): CvArchetype {
    const evidence = [candidate.title, ...candidate.skills, ...candidate.systems, ...candidate.jobFunctions].join(" ");
    for (const archetype of archetypes) {
      if (archetype.match.test(evidence)) {
        return archetype;
      }
    }
    return archetypes[hash % archetypes.length];
  }

  private describeRole(type: CvArchetype, years: number): string {
    if (years >= 8) {
      return "Senior " + type.role;
    }
    return type.role;
  }

  private selectProjects(type: CvArchetype, hash: number): CvArchetype["projects"] {
    const firstProject = type.projects[hash % type.projects.length];
    const secondProject = type.projects[(hash + 1) % type.projects.length];
    return [firstProject, secondProject];
  }

  private copyTechnicalSkills(type: CvArchetype): CandidateCvProfile["technicalSkills"] {
    return {
      languages: [...type.languages],
      frameworks: [...type.frameworks],
      databases: [...type.databases],
      tools: [...type.tools],
    };
  }

  private createEmploymentHistory(
    type: CvArchetype,
    projects: CvArchetype["projects"],
    hash: number,
    years: number,
    role: string
  ): CandidateCvProfile["employmentHistory"] {
    const firstEmployer = ["Cedar", "Harbor", "Maple"][hash % 3];
    const secondEmployer = ["Summit", "Orchard", "River"][hash % 3];
    return [
      {
        employer: `Demo ${firstEmployer} Services`,
        role: type.role,
        location: "Demo regional office",
        start: `${2026 - years}-04`,
        end: "2023-03",
        responsibilities: [projects[1].contribution, "Worked with stakeholders to clarify requirements and maintain delivery documentation."],
      },
      {
        employer: `Demo ${secondEmployer} Group`,
        role,
        location: "Demo Tokyo office",
        start: "2023-04",
        end: "2026-10",
        responsibilities: [projects[0].contribution, this.describeTeamResponsibility(years)],
      },
    ];
  }

  private describeTeamResponsibility(years: number): string {
    if (years >= 8) {
      return "Mentored colleagues and reviewed solution designs.";
    }
    return "Collaborated with colleagues on testing, issue resolution and handover.";
  }

  private createProjectDetails(
    projects: CvArchetype["projects"],
    technicalSkills: CandidateCvProfile["technicalSkills"],
    role: string
  ): CandidateCvProfile["projects"] {
    const details: CandidateCvProfile["projects"] = [];
    for (const project of projects) {
      details.push({
        name: project.name,
        description: project.description,
        role,
        technologies: this.collectTechnologies(technicalSkills),
        contributions: [project.contribution, "Participated in requirements, validation and delivery reviews."],
      });
    }
    return details;
  }

  private collectTechnologies(skills: CandidateCvProfile["technicalSkills"]): string[] {
    const technologies: string[] = [];
    for (const category of Object.values(skills)) {
      technologies.push(...category);
    }
    return technologies;
  }

  private createLanguages(hash: number): CandidateCvProfile["languages"] {
    let englishLevel = "Fluent";
    if (hash % 2 !== 0) {
      englishLevel = "Business";
    }
    let japaneseLevel = "Business";
    if (hash % 3 !== 0) {
      japaneseLevel = "Conversational";
    }
    return [
      {
        language: "English",
        level: englishLevel
      },
      {
        language: "Japanese",
        level: japaneseLevel
      },
    ];
  }
}
