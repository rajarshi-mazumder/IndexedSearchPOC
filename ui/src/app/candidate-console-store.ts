import { computed, Injectable, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { CandidateConsoleApi } from "./candidate-console-api";
import type { ConsoleConfiguration, OperationRecord, OperationRequest, OperationSummary } from "../../../shared/candidate-console-contracts";

@Injectable({ providedIn: "root" })
export class CandidateConsoleStore {
  readonly ready = signal(false);
  readonly connected = signal(false);
  readonly error = signal("");
  readonly notice = signal("");
  readonly profiles = signal<ConsoleConfiguration[]>([]);
  readonly configuration = signal<ConsoleConfiguration>({ id: "default", name: "Current environment", sfOrg: "full", awsProfile: "default",
    awsRegion: "ap-northeast-1", endpoint: "", modelId: "", roleArn: "", index: "candidates-fsb", automaticPipelines: true,
    ingestPipeline: "", searchPipeline: "", dataset: "fsb" });
  readonly operations = signal<OperationSummary[]>([]);
  readonly selected = signal<OperationRecord | null>(null);
  readonly details = signal<Record<string, OperationRecord>>({});
  readonly catalogRevision = signal(0);
  readonly mutationRunning = computed(() => this.operations().some((item) => item.kind !== "search" && this.active(item)));
  readonly searchRunning = computed(() => this.operations().some((item) => item.kind === "search" && this.active(item)));
  private events?: EventSource;
  constructor(readonly api: CandidateConsoleApi) {}

  async initialize(): Promise<void> {
    try {
      await this.api.initialize();
      const [profiles, operations] = await Promise.all([this.api.profiles(), this.api.operations()]);
      this.profiles.set(profiles); this.configuration.set(profiles[0]); this.operations.set(operations); this.ready.set(true);
      this.connect();
      for (const kind of ["fetch", "embed", "setup", "search", "enrich"]) {
        const latest = operations.find((item) => item.kind === kind); if (latest) void this.loadDetail(latest.id).catch((error) => this.fail(error));
      }
    } catch (error) { this.fail(error); }
  }
  chooseProfile(id: string): void {
    const profile = this.profiles().find((item) => item.id === id);
    if (profile) this.configuration.set(structuredClone(profile));
  }
  async save(profile: ConsoleConfiguration): Promise<boolean> {
    try {
      const profiles = await this.api.save(profile); this.profiles.set(profiles);
      this.configuration.set(structuredClone(profile)); this.notice.set("Configuration saved on this machine."); return true;
    } catch (error) { this.fail(error); return false; }
  }
  forTarget(dataset: string, index?: string): ConsoleConfiguration {
    const current = this.configuration();
    return { ...current, dataset, ...(index ? { index, automaticPipelines: index !== current.index ? true : current.automaticPipelines } : {}) };
  }
  async start(request: OperationRequest): Promise<OperationRecord | null> {
    try {
      this.error.set(""); const job = await this.api.start(request); this.update(job); await this.select(job.id);
      return this.selected();
    } catch (error) { this.fail(error); return null; }
  }
  async select(id: string): Promise<void> {
    try { this.selected.set(await this.loadDetail(id)); } catch (error) { this.fail(error); }
  }
  recordFor(kind: OperationRequest["kind"]): OperationRecord | null {
    const latest = this.operations().find((item) => item.kind === kind); return latest ? this.details()[latest.id] ?? null : null;
  }
  private async loadDetail(id: string): Promise<OperationRecord> {
    const record = await this.api.operation(id);
    this.details.update((details) => ({ ...details, [id]: record }));
    if (this.selected()?.id === id) this.selected.set(record);
    return record;
  }
  async stop(id: string): Promise<void> {
    try { this.update(await this.api.stop(id)); await this.select(id); } catch (error) { this.fail(error); }
  }
  active(job: OperationSummary): boolean { return ["running", "stopping"].includes(job.status); }
  fail(error: unknown): void {
    const message = error instanceof HttpErrorResponse ? error.error?.error ?? (error.status === 0 ? "Cannot reach the local console. Check that npm run ui is still running." : error.message)
      : error instanceof Error ? error.message : "Something went wrong";
    this.error.set(String(message));
  }
  private connect(): void {
    this.events?.close(); this.events = new EventSource("/api/events");
    this.events.onopen = () => this.connected.set(true);
    this.events.onerror = () => this.connected.set(false);
    this.events.addEventListener("snapshot", (event) => {
      this.operations.set(JSON.parse((event as MessageEvent).data));
      const selected = this.selected(); if (selected) void this.select(selected.id);
      this.catalogRevision.update((value) => value + 1);
    });
    this.events.addEventListener("operation", (event) => this.update(JSON.parse((event as MessageEvent).data)));
  }
  private update(job: OperationSummary): void {
    this.operations.update((items) => [job, ...items.filter((item) => item.id !== job.id)].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 100));
    this.details.update((details) => {
      const previous = details[job.id]; if (!previous) return details;
      const events = previous.progress.message !== job.progress.message
        ? [...previous.events, { at: new Date().toISOString(), message: job.progress.message }].slice(-150) : previous.events;
      return { ...details, [job.id]: { ...previous, ...job, events } };
    });
    if (this.selected()?.id === job.id) {
      this.selected.set(this.details()[job.id] ?? this.selected());
    }
    if (!this.active(job) || !this.details()[job.id]) void this.loadDetail(job.id).catch((error) => this.fail(error));
    if (!this.active(job) || (job.kind === "fetch" && job.progress.file)) this.catalogRevision.update((value) => value + 1);
  }
}
