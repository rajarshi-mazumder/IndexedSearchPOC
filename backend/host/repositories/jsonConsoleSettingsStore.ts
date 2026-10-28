import { CandidateConsoleSettingsStore } from "../ports/candidateConsoleSettingsStore";
import { consoleConfigurationSchema } from "../services/candidateConsoleValidation";
import { ConsoleConfiguration } from "../../../shared/candidateConsoleContracts";
import { AtomicJsonFileStore } from "../../candidateData/repositories/atomicJsonFileStore";
export class JsonConsoleSettingsStore implements CandidateConsoleSettingsStore {
  constructor(private readonly file: AtomicJsonFileStore) {}
  async read(): Promise<ConsoleConfiguration[]> { return consoleConfigurationSchema.array().parse(await this.file.read([])); }
  write(profiles: ConsoleConfiguration[]): Promise<void> { return this.file.write(consoleConfigurationSchema.array().parse(profiles)); }
}
