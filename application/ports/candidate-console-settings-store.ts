import { ConsoleConfiguration } from "../../shared/candidate-console-contracts";
export interface CandidateConsoleSettingsStore {
  read(): Promise<ConsoleConfiguration[]>;
  write(profiles: ConsoleConfiguration[]): Promise<void>;
}
