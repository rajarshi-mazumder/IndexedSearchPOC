import { Component, computed, effect, input, output, signal, untracked } from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { CandidateConsoleStore } from "../candidate-console-store";
import { CandidateTableComponent } from "../candidate-table-component";
import type { CandidatePreview, ConsoleConfiguration, ConsoleSearchResult, DatasetListing } from "../../../../shared/candidateConsoleContracts";

@Component({ selector: "candidate-batch-browser", standalone: true, imports: [DatePipe, DecimalPipe, CandidateTableComponent], template: `
  <section class="card batch-library"><div class="section-heading"><div><span class="eyebrow">Dataset · {{configuration().dataset}}</span><h2>Batch library <span class="count">{{listing()?.totalFiles ?? 0}}</span></h2>
      <p>{{listing()?.checkpoint?.fetched?.toLocaleString() ?? '0'}} records exported. Open a file to inspect candidates before embedding.</p></div>
      <button class="button secondary small" (click)="refresh()" [disabled]="loading()">{{loading() ? 'Refreshing…' : '↻ Refresh'}}</button></div>
    @if (selectable()) { <div class="selection-bar"><label class="checkbox-line"><input type="checkbox" [disabled]="loading() || !listing()?.files?.length" [checked]="pageSelected()" (change)="togglePage()" /> Select this page</label><span>{{selected().length}} file(s) selected</span><button class="button text small" (click)="clearSelection()">Clear</button></div> }
    @if (listing()?.files?.length) {
      <div class="table-scroll"><table><thead><tr>@if (selectable()) { <th class="check-cell"></th> }<th>Batch file</th><th>Records</th><th>Size</th><th>Saved</th><th>Last embedding in {{configuration().index}}</th><th></th></tr></thead><tbody>
        @for (file of listing()!.files; track file.name) { <tr [class.selected-row]="previewFile() === file.name">
          @if (selectable()) { <td><input type="checkbox" [attr.aria-label]="'Select ' + file.name" [disabled]="loading() || !file.committed" [checked]="selected().includes(file.name)" (change)="toggle(file.name)" /></td> }
          <td class="mono"><span class="file-icon">▤</span>{{file.name}} @if (!file.committed) { <span class="status stopping">Uncommitted</span> }</td>
          <td>{{file.records ?? '—'}}</td><td class="muted">{{file.size / 1024 | number:'1.0-1'}} KB</td><td class="muted">{{file.modifiedAt | date:'MMM d, HH:mm'}}</td>
          <td>@if (file.lastEmbedding; as last) { <span class="status" [class]="'status ' + (last.changed ? 'stopping' : 'succeeded')">{{last.changed ? 'Needs re-embedding' : 'Run succeeded'}}</span><span class="subtext">{{last.indexed}} indexed · {{last.skipped}} skipped</span> } @else { <span class="muted">No recorded run</span> }</td>
          <td><button class="button text small" (click)="open(file.name)">Preview</button></td></tr> }
      </tbody></table></div>
      <div class="pagination"><span>{{listing()!.totalFiles}} files · page {{page()}} of {{pageCount()}}</span><div><button class="button secondary small" [disabled]="page() === 1 || loading()" (click)="changePage(-1)">← Previous</button><button class="button secondary small" [disabled]="page() >= pageCount() || loading()" (click)="changePage(1)">Next →</button></div></div>
    } @else { <div class="empty-state"><span class="empty-mark">▤</span><h3>No batch files yet</h3><p>Fetch records into this dataset to create your first file of up to 1,000 candidates.</p></div> }
  </section>
  @if (previewFile()) {
    <section class="card preview-card"><div class="section-heading"><div><span class="eyebrow">Candidate preview</span><h2 class="mono">{{previewFile()}}</h2><p>Showing {{preview()?.candidates?.length ?? 0}} of {{preview()?.total ?? 0}} candidates. Sorting applies to this page.</p></div><button class="button text" (click)="previewFile.set('')">Close preview ×</button></div>
      @if (preview()?.quality; as quality) { <p class="notice">Whole file: {{quality.withSkills}}/{{quality.total}} with skills · {{quality.withSystems}} with technologies · {{quality.withLanguages}} with languages · {{quality.withWarnings}} with quality notes · {{quality.associations}} associations</p> }
      <candidate-table [rows]="previewRows()" [emptyTitle]="previewLoading() ? 'Loading candidates…' : 'No candidates in this file'" />
      <div class="pagination"><span>Page {{previewPage()}} of {{previewPageCount()}}</span><div><button class="button secondary small" [disabled]="previewPage() === 1 || previewLoading()" (click)="previewMove(-1)">← Previous</button><button class="button secondary small" [disabled]="previewPage() >= previewPageCount() || previewLoading()" (click)="previewMove(1)">Next →</button></div></div>
    </section>
  }
` })
export class CandidateBatchBrowserComponent {
  readonly configuration = input.required<ConsoleConfiguration>();
  readonly selectable = input(false);
  readonly selectionChange = output<string[]>();
  readonly listing = signal<DatasetListing | null>(null);
  readonly loading = signal(false); readonly page = signal(1); readonly selected = signal<string[]>([]);
  readonly preview = signal<CandidatePreview | null>(null); readonly previewFile = signal(""); readonly previewPage = signal(1); readonly previewLoading = signal(false);
  readonly pageCount = computed(() => Math.max(1, Math.ceil((this.listing()?.totalFiles ?? 0) / 20)));
  readonly previewPageCount = computed(() => Math.max(1, Math.ceil((this.preview()?.total ?? 0) / 20)));
  readonly previewRows = computed<ConsoleSearchResult[]>(() => (this.preview()?.candidates ?? []).map((candidate) => ({ rank: 0, score: 0, candidate, profile: "" })));
  private requestNumber = 0;
  constructor(readonly store: CandidateConsoleStore) {
    effect(() => { this.configuration(); untracked(() => { this.page.set(1); this.clearSelection(); this.previewFile.set(""); void this.refresh(); }); });
    effect(() => { this.store.catalogRevision(); untracked(() => { void this.refresh(); if (this.previewFile()) void this.loadPreview(); }); });
  }
  async refresh(): Promise<void> {
    const sequence = ++this.requestNumber; this.loading.set(true);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(this.configuration().dataset)) { this.listing.set(null); this.loading.set(false); return; }
    try { const listing = await this.store.api.batches(this.configuration(), this.page()); if (sequence === this.requestNumber) this.listing.set(listing); }
    catch (error) { this.store.fail(error); } finally { if (sequence === this.requestNumber) this.loading.set(false); }
  }
  toggle(file: string): void { this.selected.update((files) => files.includes(file) ? files.filter((item) => item !== file) : [...files, file]); this.selectionChange.emit(this.selected()); }
  clearSelection(): void { this.selected.set([]); this.selectionChange.emit([]); }
  pageSelected(): boolean { const files = this.listing()?.files.filter((file) => file.committed) ?? []; return files.length > 0 && files.every((file) => this.selected().includes(file.name)); }
  togglePage(): void {
    const files = this.listing()?.files.filter((file) => file.committed).map((file) => file.name) ?? [];
    this.selected.set(this.pageSelected() ? this.selected().filter((file) => !files.includes(file)) : [...new Set([...this.selected(), ...files])]);
    this.selectionChange.emit(this.selected());
  }
  changePage(direction: number): void { this.page.update((page) => page + direction); void this.refresh(); }
  open(file: string): void { this.previewFile.set(file); this.previewPage.set(1); void this.loadPreview(); }
  previewMove(direction: number): void { this.previewPage.update((page) => page + direction); void this.loadPreview(); }
  private async loadPreview(): Promise<void> {
    const file = this.previewFile(); this.previewLoading.set(true);
    try { const preview = await this.store.api.preview(this.configuration().dataset, file, this.previewPage()); if (file === this.previewFile()) this.preview.set(preview); }
    catch (error) { this.store.fail(error); } finally { this.previewLoading.set(false); }
  }
}
