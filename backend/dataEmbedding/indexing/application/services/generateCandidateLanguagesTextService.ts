import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";

/** Spoken languages listed once each; Salesforce levels win over CV levels for the same language. */
export class GenerateCandidateLanguagesTextService implements CandidateTextGenerator {
  public generate(candidate: Candidate): string {
    const languages = new Map<string, string>();
    for (const language of candidate.languages) {
      this.addLanguage(languages, language.code, language.level);
    }
    for (const language of candidate.enrichment?.cvProfile?.languages ?? []) {
      this.addLanguage(languages, language.language, language.level);
    }
    if (languages.size === 0) {
      return "";
    }
    return `Languages: ${[...languages.values()].join(", ")}`;
  }

  private addLanguage(languages: Map<string, string>, language: string, level: string): void {
    const key = language.trim().toLowerCase();
    if (!key || languages.has(key)) {
      return;
    }
    languages.set(key, this.formatLanguage(language, level));
  }

  private formatLanguage(language: string, level: string): string {
    if (!level) {
      return language;
    }
    return `${language} (${level})`;
  }
}
