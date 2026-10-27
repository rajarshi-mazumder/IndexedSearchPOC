import { ConsoleConfiguration, FileEmbeddingResult } from "../../shared/candidate-console-contracts";
export interface CandidateEmbeddingHistory {
  embeddingHistory(configuration: ConsoleConfiguration): (FileEmbeddingResult & { at: string })[];
}
