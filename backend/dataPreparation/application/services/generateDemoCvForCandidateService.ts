import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvProfile } from "../../../../shared/domain/models/candidateCvProfile";
import { DemoCvArchetype, DemoCvProjectTemplate } from "../models/demoCvArchetype";
import { DemoCvCatalog, DemoCvSeniorityLevel } from "../models/demoCvCatalog";
import { CandidateCvGenerator } from "../ports/candidateCvGenerator";

/** Stored as `source.generatorVersion`; bump it whenever the catalog or assembly rules change generated output. */
const generatorVersion = 2;
/** Dates are relative to a fixed reference month so repeated runs are stable without reading the clock. */
const referenceYear = 2026;
const referenceMonth = "10";
const minimumYearsOfExperience = 2;
const maximumYearsOfExperience = 24;

interface DemoCvJobPeriod {
  start: string;
  end: string;
  experienceYears: number;
}

/** Pure templates: no credentials, network calls, clock dependence or per-record I/O. */
export class GenerateDemoCvForCandidateService implements CandidateCvGenerator {
  public constructor(private readonly catalog: DemoCvCatalog) { }

  public generate(candidate: Candidate, seed: string): CandidateCvProfile {
    const key = this.createKey(candidate.id, seed);
    const archetype = this.selectArchetype(candidate, key);
    const years = minimumYearsOfExperience + this.choose(key, "years", maximumYearsOfExperience - minimumYearsOfExperience + 1);
    const careerStartYear = referenceYear - years;
    const role = this.describeRole(archetype, years);
    const projects = this.selectProjects(archetype, key, years);
    const technicalSkills = this.copyTechnicalSkills(archetype);
    return {
      source: {
        kind: "synthetic",
        generatorVersion,
        seed,
        archetype: archetype.name
      },
      summary: this.createSummary(archetype, key, role, years, projects),
      technicalSkills,
      employmentHistory: this.createEmploymentHistory(archetype, key, projects, careerStartYear, years),
      projects: this.createProjectDetails(projects, technicalSkills, role, key),
      education: this.createEducation(archetype, key, careerStartYear, years),
      certifications: this.createCertifications(archetype, key, careerStartYear, years),
      languages: this.createLanguages(archetype, key),
    };
  }

  private createKey(candidateId: string, seed: string): string {
    // Versioned so each generator version draws from its own hash space; v1 CVs are not reproduced by v2 anyway.
    return `${seed}:${candidateId}:v${generatorVersion}`;
  }

  /** Independent deterministic draw per CV aspect, so employers, languages and dates do not move in lockstep. */
  private choose(key: string, aspect: string, count: number): number {
    return this.hash(`${key}:${aspect}`) % count;
  }

  private hash(text: string): number {
    let hash = 2166136261;
    for (const character of text) {
      // FNV-1a per character: fast, stable across platforms and free of randomness.
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    return this.mixBits(hash);
  }

  /** FNV-1a's low bits are only the parity of the input; this avalanche step makes small moduli independent per aspect. */
  private mixBits(hash: number): number {
    let mixed = hash ^ (hash >>> 16);
    mixed = Math.imul(mixed, 0x85ebca6b);
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 0xc2b2ae35);
    mixed ^= mixed >>> 16;
    return mixed >>> 0;
  }

  private pick<T>(items: readonly T[], key: string, aspect: string): T {
    return items[this.choose(key, aspect, items.length)];
  }

  /** Among archetypes backed by the most evidence entries, pick one by hash; unrecognised candidates draw from the whole catalog. */
  private selectArchetype(candidate: Candidate, key: string): DemoCvArchetype {
    const strongest = this.findStrongestMatches(this.collectEvidence(candidate));
    if (strongest.length === 0) {
      return this.pick(this.catalog.archetypes, key, "archetype");
    }
    return this.pick(strongest, key, "archetype");
  }

  private collectEvidence(candidate: Candidate): string[] {
    const evidence: string[] = [];
    for (const value of [candidate.title, ...candidate.skills, ...candidate.systems, ...candidate.jobFunctions]) {
      if (value && value.trim()) {
        evidence.push(value.trim());
      }
    }
    return evidence;
  }

  private findStrongestMatches(evidence: string[]): DemoCvArchetype[] {
    let strongest: DemoCvArchetype[] = [];
    let strongestScore = 0;
    for (const archetype of this.catalog.archetypes) {
      const score = this.scoreEvidence(archetype, evidence);
      if (score > strongestScore) {
        strongest = [archetype];
        strongestScore = score;
      }
      else if (score > 0 && score === strongestScore) {
        strongest.push(archetype);
      }
    }
    return strongest;
  }

  private scoreEvidence(archetype: DemoCvArchetype, evidence: string[]): number {
    let score = 0;
    for (const value of evidence) {
      if (archetype.match.test(value)) {
        score += 1;
      }
    }
    return score;
  }

  private describeRole(archetype: DemoCvArchetype, experienceYears: number): string {
    const level = this.findSeniority(experienceYears);
    if (!level.prefix) {
      return archetype.role;
    }
    return `${level.prefix} ${archetype.role}`;
  }

  private findSeniority(experienceYears: number): DemoCvSeniorityLevel {
    const levels = this.catalog.employment.seniorityLevels;
    let selected = levels[0];
    for (const level of levels) {
      if (experienceYears >= level.minimumYears) {
        selected = level;
      }
    }
    return selected;
  }

  private selectProjects(archetype: DemoCvArchetype, key: string, years: number): DemoCvProjectTemplate[] {
    let count = 2;
    if (years >= 7 && archetype.projects.length >= 3) {
      count = 3;
    }
    const offset = this.choose(key, "projects", archetype.projects.length);
    const selected: DemoCvProjectTemplate[] = [];
    for (let index = 0; index < count; index++) {
      selected.push(archetype.projects[(offset + index) % archetype.projects.length]);
    }
    return selected;
  }

  private copyTechnicalSkills(archetype: DemoCvArchetype): CandidateCvProfile["technicalSkills"] {
    return {
      languages: [...archetype.languages],
      frameworks: [...archetype.frameworks],
      databases: [...archetype.databases],
      tools: [...archetype.tools],
    };
  }

  private createSummary(archetype: DemoCvArchetype, key: string, role: string, years: number, projects: DemoCvProjectTemplate[]): string {
    return this.pick(this.catalog.summaryTemplates, key, "summary")
      .replaceAll("{role}", role)
      .replaceAll("{years}", String(years))
      .replaceAll("{specialty}", archetype.specialty)
      .replaceAll("{firstProject}", this.describeInSentence(projects[0].name))
      .replaceAll("{secondProject}", this.describeInSentence(projects[1].name));
  }

  /** Lower-cases the leading word for mid-sentence use but keeps acronyms and mixed-case words such as "SLO", "GitOps" or "B2B". */
  private describeInSentence(name: string): string {
    const firstWord = name.split(" ")[0];
    if (/[^a-z]/.test(firstWord.slice(1))) {
      return name;
    }
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /** Oldest job first; the current job carries the first selected project and the full seniority title. */
  private createEmploymentHistory(
    archetype: DemoCvArchetype,
    key: string,
    projects: DemoCvProjectTemplate[],
    careerStartYear: number,
    years: number
  ): CandidateCvProfile["employmentHistory"] {
    const periods = this.planJobPeriods(careerStartYear, years);
    const history: CandidateCvProfile["employmentHistory"] = [];
    for (const [index, period] of periods.entries()) {
      const recency = periods.length - 1 - index;
      history.push({
        employer: this.nameEmployer(archetype, key, index),
        role: this.describeRole(archetype, period.experienceYears),
        location: this.pick(this.catalog.employment.locations, key, `location-${index}`),
        start: period.start,
        end: period.end,
        responsibilities: [
          projects[recency % projects.length].contribution,
          archetype.duties[recency % archetype.duties.length],
          this.findSeniority(period.experienceYears).teamResponsibility,
        ],
      });
    }
    return history;
  }

  private planJobPeriods(careerStartYear: number, years: number): DemoCvJobPeriod[] {
    const jobCount = this.countJobs(years);
    const boundaries: number[] = [];
    for (let index = 0; index <= jobCount; index++) {
      boundaries.push(careerStartYear + Math.round(years * index / jobCount));
    }
    const periods: DemoCvJobPeriod[] = [];
    for (let index = 0; index < jobCount; index++) {
      let end = `${boundaries[index + 1]}-03`;
      if (index === jobCount - 1) {
        end = `${referenceYear}-${referenceMonth}`;
      }
      periods.push({
        start: `${boundaries[index]}-04`,
        end,
        experienceYears: boundaries[index + 1] - careerStartYear
      });
    }
    return periods;
  }

  private countJobs(years: number): number {
    if (years >= 16) {
      return 4;
    }
    if (years >= 8) {
      return 3;
    }
    return 2;
  }

  private nameEmployer(archetype: DemoCvArchetype, key: string, jobIndex: number): string {
    const prefixes = this.catalog.employment.employerPrefixes;
    // A step of 7 is coprime with the prefix pool size, so one career never repeats an employer.
    const prefix = prefixes[(this.choose(key, "employer", prefixes.length) + jobIndex * 7) % prefixes.length];
    const suffix = this.pick(this.catalog.employment.employerSuffixes[archetype.sector], key, `employer-suffix-${jobIndex}`);
    return `Demo ${prefix} ${suffix}`;
  }

  private createProjectDetails(
    projects: DemoCvProjectTemplate[],
    technicalSkills: CandidateCvProfile["technicalSkills"],
    role: string,
    key: string
  ): CandidateCvProfile["projects"] {
    const details: CandidateCvProfile["projects"] = [];
    for (const [index, project] of projects.entries()) {
      details.push({
        name: project.name,
        description: project.description,
        role,
        technologies: this.collectTechnologies(technicalSkills),
        contributions: [project.contribution, this.pick(this.catalog.employment.projectReviewContributions, key, `project-review-${index}`)],
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

  private createEducation(archetype: DemoCvArchetype, key: string, careerStartYear: number, years: number): CandidateCvProfile["education"] {
    const institutions = this.catalog.credentials.institutions;
    const institutionIndex = this.choose(key, "institution", institutions.length);
    const bachelor = {
      qualification: `Bachelor of ${archetype.degree}`,
      institution: institutions[institutionIndex],
      graduationYear: careerStartYear
    };
    if (years < 5 || this.choose(key, "postgraduate", 4) !== 0) {
      return [bachelor];
    }
    return [
      {
        qualification: `Master of ${archetype.degree}`,
        institution: institutions[(institutionIndex + 5) % institutions.length],
        graduationYear: careerStartYear
      },
      { ...bachelor, graduationYear: careerStartYear - 2 },
    ];
  }

  private createCertifications(archetype: DemoCvArchetype, key: string, careerStartYear: number, years: number): CandidateCvProfile["certifications"] {
    let count = 1;
    if (years >= 6 && archetype.certifications.length >= 2) {
      count = 2;
    }
    const offset = this.choose(key, "certification", archetype.certifications.length);
    const certifications: CandidateCvProfile["certifications"] = [];
    for (let index = 0; index < count; index++) {
      certifications.push({
        name: archetype.certifications[(offset + index) % archetype.certifications.length],
        issuer: this.pick(this.catalog.credentials.certificationIssuers, key, `certification-issuer-${index}`),
        year: careerStartYear + 1 + this.choose(key, `certification-year-${index}`, years),
      });
    }
    return certifications;
  }

  /** Role-required languages win; otherwise a native language, English and Japanese, and sometimes a third language. */
  private createLanguages(archetype: DemoCvArchetype, key: string): CandidateCvProfile["languages"] {
    const pools = this.catalog.spokenLanguages;
    const languages: CandidateCvProfile["languages"] = [];
    for (const required of archetype.spokenLanguages ?? []) {
      this.addLanguage(languages, required.language, required.level);
    }
    if (languages.length === 0) {
      this.addLanguage(languages, this.selectNativeLanguage(key), "Native");
      this.addLanguage(languages, "English", this.pick(pools.levels, key, "english-level"));
      this.addLanguage(languages, "Japanese", this.pick(pools.levels, key, "japanese-level"));
    }
    if (this.choose(key, "additional-language", 2) === 0) {
      this.addLanguage(languages, this.pick(pools.additionalLanguages, key, "additional-language-name"), this.pick(pools.levels, key, "additional-language-level"));
    }
    return languages;
  }

  private selectNativeLanguage(key: string): string {
    if (this.choose(key, "native-language", 2) === 0) {
      return "Japanese";
    }
    return this.pick(this.catalog.spokenLanguages.nativeLanguages, key, "native-language-name");
  }

  private addLanguage(languages: CandidateCvProfile["languages"], language: string, level: string): void {
    for (const existing of languages) {
      if (existing.language === language) {
        return;
      }
    }
    languages.push({
      language,
      level
    });
  }
}
