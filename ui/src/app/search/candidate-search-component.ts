import { Component, computed, effect, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "../candidate-console-store";
import { CandidateTableComponent } from "../candidate-table-component";
import { OperationProgressComponent } from "../operation-progress-component";

@Component({ selector: "candidate-search", standalone: true, imports: [FormsModule, CandidateTableComponent, OperationProgressComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">03 / Explore your dataset</span><h1>Search candidates</h1><p>Test relevance with a mix of keyword and semantic matching.</p></div><span class="context-chip">Hybrid search</span></div>
  <section class="card search-card"><form (ngSubmit)="search()" #form="ngForm">
    <label class="search-label">What expertise are you looking for?<textarea name="query" [(ngModel)]="query" placeholder="e.g. Java Spring Boot Kafka microservices" rows="2" required maxlength="10000"></textarea></label>
    <div class="search-controls"><label>Index<input name="index" [(ngModel)]="index" required /></label><label class="limit-field">Results<input name="limit" type="number" [(ngModel)]="limit" min="1" max="100" required /></label><button type="submit" class="button primary" [disabled]="form.invalid || busy() || store.searchRunning()">{{store.searchRunning() ? 'Searching…' : 'Search candidates →'}}</button></div>
  </form></section>
  <operation-progress [job]="job()" />
  <section class="card results-card"><div class="section-heading"><div><span class="eyebrow">Ranked matches</span><h2>Search results <span class="count">{{rows().length}}</span></h2><p>{{job()?.status === 'succeeded' ? 'Results from ' + job()!.index + '. Open details to inspect the candidate profile.' : 'Results appear here after a search completes.'}}</p></div></div>
    <p>Results use equal-weight reciprocal rank fusion. Scores indicate ordering, not suitability or confidence. Raw lexical and vector scores use different scales.</p>
    <candidate-table [rows]="rows()" [ranked]="true" [emptyTitle]="job()?.status === 'succeeded' ? 'No matching candidates' : 'Your next hire starts with a search'" [emptyDescription]="job()?.status === 'succeeded' ? 'Try a broader skill or job function, or check that this index contains embedded records.' : 'Enter a skill, role, or combination of expertise above.'" />
  </section>
` })
export class CandidateSearchComponent {
  index = ""; query = ""; limit = 10; readonly busy = signal(false);
  readonly job = computed(() => this.store.recordFor("search")); readonly rows = computed(() => this.job()?.result?.candidates ?? []);
  constructor(readonly store: CandidateConsoleStore) {
    effect(() => { this.index = this.store.configuration().index; });
    const last = store.recordFor("search")?.request; if (last?.kind === "search") { this.query = last.query; this.limit = last.limit; }
  }
  async search(): Promise<void> {
    this.busy.set(true); await this.store.start({ kind: "search", configuration: this.store.forTarget(this.store.configuration().dataset, this.index), query: this.query, limit: this.limit }); this.busy.set(false);
  }
}
