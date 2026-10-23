import { Candidate } from "../../domain/entities/Candidate";

export interface ProfileGenerator {
  generate(candidate: Candidate): string;
  generateEmbeddingText(candidate: Candidate): string;
}
