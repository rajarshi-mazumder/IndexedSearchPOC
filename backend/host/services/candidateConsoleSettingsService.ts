import { ConsoleConfiguration } from "../../../shared/candidateConsoleContracts";
import { CandidateConsoleSettingsStore } from "../ports/candidateConsoleSettingsStore";
import { CandidateConsoleValidation } from "./candidateConsoleValidation";

export class CandidateConsoleSettingsService {
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private readonly store: CandidateConsoleSettingsStore, private readonly defaults: ConsoleConfiguration) {}
  async list(): Promise<ConsoleConfiguration[]> {
    await this.writes;
    const profiles = await this.store.read();
    return profiles.length ? profiles : [this.defaults];
  }
  save(value: unknown): Promise<ConsoleConfiguration[]> {
    const profile = CandidateConsoleValidation.configuration(value);
    const task = this.writes.then(async () => {
      const existing = await this.store.read();
      const profiles = existing.length ? existing : [this.defaults];
      const next = [...profiles.filter((item) => item.id !== profile.id), profile];
      if (next.length > 30) throw new Error("At most 30 saved configurations are supported.");
      await this.store.write(next);
      return next;
    });
    this.writes = task.catch(() => {});
    return task;
  }
}
