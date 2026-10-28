import { Component, computed, input, signal } from "@angular/core";
import { DecimalPipe, KeyValuePipe } from "@angular/common";
import type { ConsoleSearchResult } from "../../../shared/candidateConsoleContracts";
import { CandidateCvDetailsComponent } from "./batches/candidate-cv-details-component";

@Component({ selector: "candidate-table", standalone: true, imports: [DecimalPipe, KeyValuePipe, CandidateCvDetailsComponent], template: `
  @if (rows().length) {
    <div class="table-scroll"><table class="candidate-table"><thead><tr>
      @if (ranked()) { <th>#</th><th><button class="sort" (click)="sortBy('score')">Score ↕</button></th> }
      <th><button class="sort" (click)="sortBy('name')">Candidate ↕</button></th>
      <th><button class="sort" (click)="sortBy('title')">Title ↕</button></th>
      <th><button class="sort" (click)="sortBy('company')">Company ↕</button></th><th>Skills / technologies</th><th>Job functions</th><th></th>
    </tr></thead><tbody>
      @for (row of sorted(); track row.candidate.id) {
        <tr>
          @if (ranked()) { <td class="muted mono">{{row.rank}}</td><td class="score">{{row.score | number:'1.3-3'}}</td> }
          <td><strong>{{row.candidate.name}}</strong><span class="subtext mono">{{row.candidate.id}}</span>@if (row.candidate.enrichment?.cvProfile) { <span class="status stopping">Demo CV</span> }</td>
          <td>{{row.candidate.title || '—'}}</td><td>{{row.candidate.company || '—'}}</td>
          <td><div class="tags">@for (skill of expertise(row).slice(0,3); track $index) { <span class="tag">{{skill}}</span> }
            @if (expertise(row).length > 3) { <span class="tag quiet">+{{expertise(row).length - 3}}</span> }
            @if (!expertise(row).length) { <span class="muted">—</span> }</div></td>
          <td class="functions">{{row.candidate.jobFunctions.join(', ') || '—'}}</td>
          <td><button class="button text small" [attr.aria-expanded]="expanded() === row.candidate.id" (click)="expanded.set(expanded() === row.candidate.id ? '' : row.candidate.id)">{{expanded() === row.candidate.id ? 'Close' : 'Details'}}</button></td>
        </tr>
        @if (expanded() === row.candidate.id) {
          <tr class="detail-row"><td [attr.colspan]="ranked() ? 8 : 6"><div class="detail-grid">
            @if (row.candidate.enrichment?.cvProfile; as cv) { <candidate-cv-details class="span-all" [cv]="cv" /> }
            <div><span class="eyebrow">Skills</span><p>{{row.candidate.skills.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Expertise</span><p>{{row.candidate.skillCategories.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Systems</span><p>{{row.candidate.systems.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Industries</span><p>{{row.candidate.industries.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Specializations</span><p>{{row.candidate.subIndustries.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Location / salary</span><p>{{row.candidate.location || '—'}} · {{row.candidate.salary ?? '—'}}</p></div>
            <div><span class="eyebrow">Languages</span>
              @for (language of row.candidate.languages; track $index) { <p>{{language.code}} · {{language.level || 'Level not provided'}}</p> }
            </div>
            @if (row.candidate.enrichment; as enrichment) {
              <div><span class="eyebrow">Source coverage</span><p>{{enrichment.associations.length}} associations · {{enrichment.tags.length}} resolved tags</p><p>Source updated: {{enrichment.modifiedAt || 'Not provided'}}</p></div>
              @for (detail of enrichment.details | keyvalue; track detail.key) {
                @if (detail.value !== null) { <div><span class="eyebrow">{{detail.key}}</span><p>{{enrichment.resolvedDetails?.[detail.key] ?? detail.value}}</p></div> }
              }
              <div class="span-all"><span class="eyebrow">Source tags</span>
                @for (tag of enrichment.tags; track tag.id) { <p>{{tag.label || tag.id}} · {{tag.type || 'Unknown type'}} · {{tag.category || 'Unclassified'}}</p> }
              </div>
              @if (enrichment.warnings.length) { <div class="span-all"><span class="eyebrow">Data quality notes</span>
                @for (warning of enrichment.warnings; track $index) { <p>{{warning}}</p> }
              </div> }
            }
            @if (row.profile) { <div class="span-all"><span class="eyebrow">Candidate profile</span><p>{{row.profile}}</p></div> }
          </div></td></tr>
        }
      }
    </tbody></table></div>
  } @else { <div class="empty-state"><span class="empty-mark">⌕</span><h3>{{emptyTitle()}}</h3><p>{{emptyDescription()}}</p></div> }
` })
export class CandidateTableComponent {
  readonly rows = input<ConsoleSearchResult[]>([]);
  readonly ranked = input(false);
  readonly emptyTitle = input("No candidates to display");
  readonly emptyDescription = input("Choose a batch file to preview its candidate records.");
  readonly expanded = signal("");
  expertise(row: ConsoleSearchResult): string[] { return [...new Set([...row.candidate.skills, ...row.candidate.systems])]; }
  private readonly sorting = signal<{ field: "name" | "title" | "company" | "score"; ascending: boolean } | null>(null);
  readonly sorted = computed(() => {
    const sort = this.sorting(); if (!sort) return this.rows();
    return [...this.rows()].sort((a, b) => {
      const difference = sort.field === "score" ? a.score - b.score : String(a.candidate[sort.field] ?? "").localeCompare(String(b.candidate[sort.field] ?? ""));
      return difference * (sort.ascending ? 1 : -1);
    });
  });
  sortBy(field: "name" | "title" | "company" | "score"): void {
    this.sorting.set({ field, ascending: this.sorting()?.field === field ? !this.sorting()!.ascending : field !== "score" });
  }
}
