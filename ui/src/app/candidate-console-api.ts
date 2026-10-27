import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import type { CandidatePreview, ConsoleConfiguration, DatasetListing, OperationRecord, OperationRequest, OperationSummary } from "../../../shared/candidate-console-contracts";

@Injectable({ providedIn: "root" })
export class CandidateConsoleApi {
  private token = "";
  constructor(private readonly http: HttpClient) {}
  async initialize(): Promise<void> { this.token = (await firstValueFrom(this.http.get<{ token: string }>("/api/session"))).token; }
  profiles(): Promise<ConsoleConfiguration[]> { return firstValueFrom(this.http.get<ConsoleConfiguration[]>("/api/settings")); }
  save(profile: ConsoleConfiguration): Promise<ConsoleConfiguration[]> {
    return firstValueFrom(this.http.put<ConsoleConfiguration[]>("/api/settings", profile, { headers: this.headers() }));
  }
  datasets(): Promise<string[]> { return firstValueFrom(this.http.get<string[]>("/api/datasets")); }
  batches(configuration: ConsoleConfiguration, page: number): Promise<DatasetListing> {
    return firstValueFrom(this.http.post<DatasetListing>("/api/batches/list", { configuration, page, pageSize: 20 }, { headers: this.headers() }));
  }
  preview(dataset: string, file: string, page: number): Promise<CandidatePreview> {
    return firstValueFrom(this.http.post<CandidatePreview>("/api/batches/preview", { dataset, file, page, pageSize: 20 }, { headers: this.headers() }));
  }
  operations(): Promise<OperationSummary[]> { return firstValueFrom(this.http.get<OperationSummary[]>("/api/operations")); }
  operation(id: string): Promise<OperationRecord> { return firstValueFrom(this.http.get<OperationRecord>(`/api/operations/${id}`)); }
  start(request: OperationRequest): Promise<OperationSummary> {
    return firstValueFrom(this.http.post<OperationSummary>("/api/operations", request, { headers: this.headers() }));
  }
  stop(id: string): Promise<OperationSummary> {
    return firstValueFrom(this.http.post<OperationSummary>(`/api/operations/${id}/stop`, {}, { headers: this.headers() }));
  }
  private headers(): Record<string, string> { return { "X-Console-Token": this.token }; }
}
