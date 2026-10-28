import { ConsoleConfiguration, FileEmbeddingResult } from "../../../shared/candidateConsoleContracts";
export interface CandidateEmbeddingHistory {
  embeddingHistory(configuration: ConsoleConfiguration): (FileEmbeddingResult & { at: string })[];
}
