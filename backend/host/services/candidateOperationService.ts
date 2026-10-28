import { randomUUID } from "node:crypto";
import { CandidateEmbeddingHistory } from "../ports/candidateEmbeddingHistory";
import { CandidateOperationHistoryStore } from "../ports/candidateOperationHistoryStore";
import { CandidateOperationRunner, CandidateOperationHandle } from "../ports/candidateOperationRunner";
import { CandidateConsoleValidation } from "./candidateConsoleValidation";
import { ConsoleConfiguration, OperationRecord, OperationRequest, OperationSummary, WorkerEvent } from "../../../shared/candidateConsoleContracts";

export class CandidateOperationService implements CandidateEmbeddingHistory {
  private records: OperationRecord[] = [];
  private handles = new Map<string, CandidateOperationHandle>();
  private listeners = new Set<(record: OperationSummary) => void>();
  private writes: Promise<void> = Promise.resolve();
  private starts: Promise<unknown> = Promise.resolve();
  constructor(private readonly runner: CandidateOperationRunner, private readonly history: CandidateOperationHistoryStore) {}

  async initialize(): Promise<void> {
    this.records = (await this.history.read()).slice(0, 100);
    for (const record of this.records) if (["running", "stopping"].includes(record.status)) {
      record.status = "interrupted"; record.finishedAt = new Date().toISOString();
      record.error = "The console stopped before this operation finished. Resume fetching or retry the selected file.";
    }
    await this.persist();
  }
  list(): OperationSummary[] { return this.records.map((record) => this.summary(record)); }
  embeddingHistory(configuration: ConsoleConfiguration) {
    return this.records.filter((record) => record.kind === "embed" && record.dataset === configuration.dataset && record.index === configuration.index
      && record.request.configuration.endpoint === configuration.endpoint && record.request.configuration.modelId === configuration.modelId)
      .flatMap((record) => (record.result?.files ?? []).map((file) => ({ ...file, at: record.finishedAt ?? record.startedAt })));
  }
  get(id: string): OperationRecord {
    const record = this.records.find((item) => item.id === id);
    if (!record) throw new Error("Operation not found");
    return structuredClone(record);
  }
  subscribe(listener: (record: OperationSummary) => void): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  start(value: unknown): Promise<OperationSummary> {
    const request = CandidateConsoleValidation.operation(value);
    const pending = this.starts.then(() => this.launch(request));
    this.starts = pending.catch(() => {});
    return pending;
  }
  stop(id: string): OperationSummary {
    const record = this.records.find((item) => item.id === id);
    const handle = this.handles.get(id);
    if (!record || !handle) throw new Error("This operation is no longer running.");
    record.status = "stopping";
    this.message(record, "Stop requested. Finishing the current batch or request.");
    handle.stop(); this.publish(record);
    return this.summary(record);
  }
  async close(): Promise<void> {
    for (const record of this.records) if (["running", "stopping"].includes(record.status)) {
      record.status = "interrupted"; record.finishedAt = new Date().toISOString();
      this.message(record, "Console stopped. Resume fetching or retry unfinished files when it restarts.");
    }
    for (const handle of this.handles.values()) handle.terminate();
    await this.persist();
  }
  private async launch(request: OperationRequest): Promise<OperationSummary> {
    const active = this.records.filter((item) => ["running", "stopping"].includes(item.status));
    if (active.length >= 2 || (request.kind !== "search" && active.some((item) => item.kind !== "search"))) {
      throw new Error("Another data operation is running. Wait for it to finish or stop it first. Search can run alongside it.");
    }
    const now = new Date().toISOString();
    const record: OperationRecord = { id: randomUUID(), kind: request.kind, status: "running",
      profileName: request.configuration.name, index: request.configuration.index, dataset: request.configuration.dataset,
      startedAt: now, request: structuredClone(request), progress: { message: "Starting operation" },
      events: [{ at: now, message: "Starting operation" }] };
    this.records = [record, ...this.records].slice(0, 100);
    try { await this.persist(); } catch (error) { this.records = this.records.filter((item) => item.id !== record.id); throw error; }
    this.publish(record);
    try {
      const handle = this.runner.start(request, (event) => this.accept(record, event), (error) => {
        this.handles.delete(record.id);
        if (["running", "stopping"].includes(record.status)) {
          record.status = "failed"; record.error = error ?? "Worker exited without a result.";
          record.finishedAt = new Date().toISOString(); this.message(record, record.error); this.publish(record); this.persistRecord(record);
        }
      });
      this.handles.set(record.id, handle);
    } catch (error) {
      record.status = "failed"; record.error = error instanceof Error ? error.message : "Could not start worker";
      record.finishedAt = new Date().toISOString(); this.message(record, record.error); this.publish(record); await this.persist();
    }
    return this.summary(record);
  }
  private accept(record: OperationRecord, event: WorkerEvent): void {
    if (!["running", "stopping"].includes(record.status)) return;
    if (event.type === "progress") { record.progress = event.progress; this.message(record, event.progress.message); }
    if (event.type === "file") {
      record.result = { ...record.result, files: [...(record.result?.files ?? []), event.result] };
      this.persistRecord(record);
    }
    if (event.type === "result" || event.type === "error") {
      record.finishedAt = new Date().toISOString();
      if (event.type === "result") {
        record.result = { ...record.result, ...event.result };
        record.status = event.cancelled ? "cancelled" : "succeeded";
        this.message(record, event.cancelled ? "Stopped. Completed batches remain available." : "Operation completed successfully.");
      } else { record.status = "failed"; record.error = event.message; this.message(record, event.message); }
      this.persistRecord(record);
    }
    this.publish(record);
  }
  private message(record: OperationRecord, message: string): void {
    record.events.push({ at: new Date().toISOString(), message }); record.events = record.events.slice(-150);
  }
  private summary(record: OperationRecord): OperationSummary {
    const { request, result, events, ...summary } = record; return structuredClone(summary);
  }
  private publish(record: OperationRecord): void { for (const listener of this.listeners) listener(this.summary(record)); }
  private persistRecord(record: OperationRecord): void {
    void this.persist().catch(() => {
      record.error = "Could not save operation history locally. Check free disk space and folder permissions.";
      this.publish(record);
    });
  }
  private persist(): Promise<void> {
    const snapshot = structuredClone(this.records);
    const task = this.writes.then(() => this.history.write(snapshot));
    this.writes = task.catch(() => {}); return task;
  }
}
