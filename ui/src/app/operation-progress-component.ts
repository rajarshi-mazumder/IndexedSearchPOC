import { Component, input, signal, OnDestroy } from "@angular/core";
import { DatePipe } from "@angular/common";
import { CandidateConsoleStore } from "./candidate-console-store";
import type { OperationRecord } from "../../../shared/candidateConsoleContracts";

@Component({ selector: "operation-progress", standalone: true, imports: [DatePipe], template: `
  @if (job(); as run) {
    <section class="card operation-card" aria-live="polite">
      <div class="section-heading"><div><span class="eyebrow">Operation · {{run.kind}}</span><h3>{{run.progress.message}}</h3></div>
        <div class="inline"><span class="status" [class]="'status ' + run.status">{{run.status}}</span><span class="mono muted">{{elapsed(run)}}s</span>
          @if (store.active(run)) { <button class="button danger small" [disabled]="run.status === 'stopping'" (click)="store.stop(run.id)">Stop</button> }</div></div>
      @if (store.active(run) || run.progress.total !== undefined) {
        <div class="progress-track" role="progressbar" [attr.aria-label]="run.progress.message" [attr.aria-valuenow]="percent(run)" aria-valuemin="0" aria-valuemax="100">
          <div [class.indeterminate]="percent(run) === null && store.active(run)" [style.width.%]="percent(run) ?? (store.active(run) ? 35 : 100)"></div>
        </div>
      }
      <div class="operation-metrics">
        @if (run.progress.fetched !== undefined) { <span><strong>{{run.progress.fetched.toLocaleString()}}</strong> records saved in dataset</span> }
        @if (run.progress.total !== undefined) { <span><strong>{{run.progress.processed}} / {{run.progress.total}}</strong> processed in file</span> }
        @if (run.progress.indexed !== undefined) { <span><strong>{{run.progress.indexed}}</strong> indexed · <strong>{{run.progress.skipped}}</strong> skipped</span> }
        @if (run.progress.changed !== undefined) { <span><strong>{{run.progress.changed}}</strong> prepared · <strong>{{run.progress.skipped}}</strong> skipped</span> }
        @if (run.progress.fileTotal) { <span>File <strong>{{run.progress.fileNumber}} / {{run.progress.fileTotal}}</strong></span> }
        <span class="mono">{{run.kind === 'fetch' || run.kind === 'enrich' ? run.dataset : run.index}}</span>
      </div>
      @if (run.error) { <div class="alert error">{{run.error}}</div> }
      @if (run.result?.enrichment; as result) { <p>{{result.changed}} candidates changed · {{result.skipped}} skipped · {{result.completedFiles}} files processed.</p> }
      @if (run.result?.modelId; as modelId) { <div class="result-callout">Registered model: <code>{{modelId}}</code>
        <button class="button secondary small" (click)="useModel(modelId, run)">Use model in configuration</button></div> }
      @if (run.result?.fetched !== undefined) { <p class="muted">{{run.result.fetched.toLocaleString()}} records across {{run.result.batchNumber}} files. {{run.result.complete ? 'Export complete.' : 'Use Resume to fetch more.'}}</p> }
      <details class="log-details"><summary>Operation log <span class="muted">{{run.events.length}} events</span></summary><div class="log-output">
        @for (event of run.events; track $index) { <div><time>{{event.at | date:'HH:mm:ss'}}</time><span>{{event.message}}</span></div> }
      </div></details>
    </section>
  }
` })
export class OperationProgressComponent implements OnDestroy {
  readonly job = input<OperationRecord | null>(null);
  private readonly clock = signal(Date.now());
  private readonly timer = setInterval(() => this.clock.set(Date.now()), 1000);
  constructor(readonly store: CandidateConsoleStore) {}
  ngOnDestroy(): void { clearInterval(this.timer); }
  elapsed(job: OperationRecord): number { return Math.max(0, Math.floor(((job.finishedAt ? Date.parse(job.finishedAt) : this.clock()) - Date.parse(job.startedAt)) / 1000)); }
  percent(job: OperationRecord): number | null { return job.progress.total ? Math.min(100, Math.floor((job.progress.processed ?? 0) / job.progress.total * 100)) : null; }
  async useModel(modelId: string, job: OperationRecord): Promise<void> {
    if (this.store.configuration().endpoint !== job.request.configuration.endpoint) { this.store.error.set("Select the configuration for this operation's collection before applying its model ID."); return; }
    await this.store.save({ ...this.store.configuration(), modelId });
  }
}
