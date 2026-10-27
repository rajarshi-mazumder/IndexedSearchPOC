import { Component, computed, effect, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "../candidate-console-store";
import { CandidateBatchBrowserComponent } from "../batches/candidate-batch-browser-component";
import { OperationProgressComponent } from "../operation-progress-component";
import { CandidateCvEnrichmentComponent } from "../batches/candidate-cv-enrichment-component";

@Component({ selector: "candidate-embed", standalone: true, imports: [FormsModule, CandidateBatchBrowserComponent, OperationProgressComponent, CandidateCvEnrichmentComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">02 / Local files → OpenSearch</span><h1>Embed & index</h1><p>Choose saved files and a destination index. Files run one at a time, in batch order.</p></div></div>
  <section class="card"><form #form="ngForm"><div class="form-grid two">
    <label>Source dataset<input name="dataset" [ngModel]="dataset()" (ngModelChange)="dataset.set($event)" required pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}" /></label>
    <label>Destination index<input name="index" [ngModel]="index()" (ngModelChange)="index.set($event)" required /></label>
  </div><div class="pipeline-note"><span class="eyebrow">Ingest pipeline</span><code>{{target().automaticPipelines ? index() + '-ingest' : target().ingestPipeline}}</code><span class="eyebrow">Search pipeline</span><code>{{target().automaticPipelines ? index() + '-hybrid' : target().searchPipeline}}</code></div>
  <div class="form-footer"><p>Set up each new index once. Embedding upserts by Salesforce ID; retrying a file updates its records.</p><div class="inline"><button class="button secondary" type="button" [disabled]="form.invalid || busy() || store.mutationRunning()" (click)="setup()">Set up index</button><button class="button primary" type="button" [disabled]="form.invalid || !files().length || busy() || store.mutationRunning()" (click)="embed()">Embed {{files().length ? files().length + ' selected file(s)' : 'selected files'}}</button></div></div></form></section>
  <operation-progress [job]="store.recordFor('setup')" />
  <operation-progress [job]="store.recordFor('embed')" />
  <candidate-batch-browser [configuration]="target()" [selectable]="true" (selectionChange)="files.set($event)" />
  <candidate-cv-enrichment [configuration]="target()" [files]="files()" />
` })
export class CandidateEmbedComponent {
  readonly dataset = signal(""); readonly index = signal(""); readonly files = signal<string[]>([]); readonly busy = signal(false);
  readonly target = computed(() => this.store.forTarget(this.dataset(), this.index()));
  constructor(readonly store: CandidateConsoleStore) { effect(() => { const config = this.store.configuration(); this.dataset.set(config.dataset); this.index.set(config.index); }); }
  async setup(): Promise<void> { this.busy.set(true); await this.store.start({ kind: "setup", configuration: this.target() }); this.busy.set(false); }
  async embed(): Promise<void> { this.busy.set(true); await this.store.start({ kind: "embed", configuration: this.target(), files: [...this.files()].sort() }); this.busy.set(false); }
}
