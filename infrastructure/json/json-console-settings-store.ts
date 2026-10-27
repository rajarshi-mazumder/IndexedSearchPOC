import { CandidateConsoleSettingsStore } from "../../application/ports/candidate-console-settings-store";
import { consoleConfigurationSchema } from "../../application/services/candidate-console-validation";
import { ConsoleConfiguration } from "../../shared/candidate-console-contracts";
import { AtomicJsonFileStore } from "./atomic-json-file-store";
export class JsonConsoleSettingsStore implements CandidateConsoleSettingsStore {
  constructor(private readonly file: AtomicJsonFileStore) {}
  async read(): Promise<ConsoleConfiguration[]> { return consoleConfigurationSchema.array().parse(await this.file.read([])); }
  write(profiles: ConsoleConfiguration[]): Promise<void> { return this.file.write(consoleConfigurationSchema.array().parse(profiles)); }
}
