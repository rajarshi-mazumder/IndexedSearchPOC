import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Keep benchmark provenance tied to all split search logic, not just the SDK call. */
export async function calculateCandidateSearchCodeHash(): Promise<string> {
  const sourceFiles = [
    "application/useCases/searchCandidatesUseCase.ts",
    "infrastructure/repositories/candidateOpenSearchSearchRepository.ts",
    "infrastructure/lexicalSearch/candidateLexicalQueryMapper.ts",
    "infrastructure/vectorSearch/candidateVectorQueryMapper.ts",
    "infrastructure/mappers/candidateIndependentSearchRequestMapper.ts",
    "infrastructure/mappers/candidateSearchResponseMapper.ts",
    "application/services/rankCandidatesByReciprocalRankService.ts",
  ];
  const hash = createHash("sha256");
  for (const file of sourceFiles) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(resolve(__dirname, "../../backend/dataSearch", file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
