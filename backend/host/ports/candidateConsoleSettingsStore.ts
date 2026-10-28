import { ConsoleConfiguration } from "../../../shared/candidateConsoleContracts";
export interface CandidateConsoleSettingsStore {
  read(): Promise<ConsoleConfiguration[]>;
  write(profiles: ConsoleConfiguration[]): Promise<void>;
}
