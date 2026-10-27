import { Component, computed, input, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "../candidate-console-store";
import { OperationProgressComponent } from "../operation-progress-component";
import { CandidateTableComponent } from "../candidate-table-component";
import type { ConsoleConfiguration } from "../../../../shared/candidate-console-contracts";

@Component({ selector: "candidate-cv-enrichment", standalone: true, imports: [FormsModule, OperationProgressComponent, CandidateTableComponent], template: `
  <section class="card"><div class="section-heading"><div><span class="eyebrow">Optional · Local enrichment</span><h2>Demo CV data</h2>
    <p>Add synthetic professional details to the selected batch files, then embed them using the existing controls.</p></div><span class="status stopping">Synthetic data</span></div>
    <div class="cv-controls"><label>Demo data seed<input name="cvSeed" [ngModel]="seed()" (ngModelChange)="seed.set($event)" maxlength="100" /></label>
    <p class="muted">Same candidate and seed produce the same CV. Change the seed and regenerate to vary the examples. Real Salesforce fields stay intact.</p>
    <div class="inline cv-actions">
      <button class="button secondary" [disabled]="disabled()" (click)="run('preview')">Preview demo CV</button>
      <button class="button primary" [disabled]="disabled()" (click)="run('add')">Add demo CV data</button>
      <button class="button secondary" [disabled]="disabled()" (click)="run('regenerate')">Regenerate demo CV</button>
      <button class="button danger" [disabled]="disabled()" (click)="run('remove')">Remove demo CV</button>
    </div>
    <p class="notice">{{files().length}} file(s) selected. Add skips existing CVs. Regenerate replaces synthetic CVs. Remove clears synthetic CVs only. Changes are backed up locally; re-embed changed files to update search.</p>
    </div>
  </section>
  <operation-progress [job]="job()" />
  @if (job(); as job) {
    @if (job.request.kind === 'enrich' && job.request.action === 'preview' && job.result?.candidates?.length) {
      <section class="card cv-preview"><div class="section-heading"><div><h2>Demo CV preview · not saved</h2><p>First 20 candidates of the first selected file. Open Details to inspect the generated sections. Preview shows regenerated examples; Add skips candidates that already have a CV.</p></div></div>
        <candidate-table [rows]="job.result!.candidates!" />
      </section>
    }
  }
`, styles: [`.cv-actions { flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; } .cv-controls { padding: 0 24px 24px; } .cv-controls label { display: block; } .cv-controls .notice { margin-bottom: 0; }`] })
export class CandidateCvEnrichmentComponent {
  readonly configuration = input.required<ConsoleConfiguration>();
  readonly files = input.required<string[]>();
  readonly seed = signal("demo-cv-v1"); readonly busy = signal(false);
  readonly job = computed(() => { const run = this.store.recordFor("enrich"); return run?.dataset === this.configuration().dataset ? run : null; });
  constructor(readonly store: CandidateConsoleStore) {}
  disabled(): boolean { return this.busy() || this.store.mutationRunning() || !this.files().length || !this.seed().trim(); }
  async run(action: "preview" | "add" | "regenerate" | "remove"): Promise<void> {
    this.busy.set(true);
    try { await this.store.start({ kind: "enrich", action, seed: this.seed().trim(), files: [...this.files()], configuration: this.configuration() }); }
    finally { this.busy.set(false); }
  }
}
