import { Component, computed, effect, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "../candidate-console-store";
import { CandidateBatchBrowserComponent } from "../batches/candidate-batch-browser-component";
import { OperationProgressComponent } from "../operation-progress-component";

@Component({ selector: "candidate-fetch", standalone: true, imports: [FormsModule, CandidateBatchBrowserComponent, OperationProgressComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">01 / Salesforce → local files</span><h1>Fetch candidates</h1><p>Build your dataset progressively. Each completed batch is saved before the next begins.</p></div><span class="context-chip">Org <strong>{{store.configuration().sfOrg || 'Not configured'}}</strong></span></div>
  <section class="card"><form (ngSubmit)="run(false)" #form="ngForm"><div class="form-grid three">
    <label>Dataset folder<input name="dataset" [ngModel]="dataset()" (ngModelChange)="dataset.set($event)" required pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}" /><small>.cache/candidates/{{dataset()}}/</small></label>
    <label>Records per file<input name="batchSize" type="number" [(ngModel)]="batchSize" min="1" max="1000" required /><small>Up to 1,000 records per batch</small></label>
    <label>Batches this run<input name="maxBatches" type="number" [(ngModel)]="maxBatches" min="1" max="10000" required /><small>Stops automatically after this many batches</small></label>
  </div><div class="form-footer"><p>Resume continues after the last saved Salesforce ID. Use the same org and batch size.</p><div class="inline"><button class="button secondary" type="button" [disabled]="form.invalid || busy() || store.mutationRunning()" (click)="run(true)">Resume fetch</button><button class="button primary" type="submit" [disabled]="form.invalid || busy() || store.mutationRunning()">Fetch new dataset</button></div></div></form></section>
  <operation-progress [job]="store.recordFor('fetch')" />
  <candidate-batch-browser [configuration]="target()" />
` })
export class CandidateFetchComponent {
  readonly dataset = signal(""); readonly busy = signal(false);
  batchSize = 1000; maxBatches = 1;
  readonly target = computed(() => this.store.forTarget(this.dataset()));
  constructor(readonly store: CandidateConsoleStore) { effect(() => this.dataset.set(this.store.configuration().dataset)); }
  async run(resume: boolean): Promise<void> {
    this.busy.set(true);
    await this.store.start({ kind: "fetch", configuration: this.target(), batchSize: this.batchSize, maxBatches: this.maxBatches, resume });
    this.busy.set(false);
  }
}
