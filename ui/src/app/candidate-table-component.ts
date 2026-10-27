import { Component, computed, input, signal } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import type { ConsoleSearchResult } from "../../../shared/candidate-console-contracts";

@Component({ selector: "candidate-table", standalone: true, imports: [DecimalPipe], template: `
  @if (rows().length) {
    <div class="table-scroll"><table class="candidate-table"><thead><tr>
      @if (ranked()) { <th>#</th><th><button class="sort" (click)="sortBy('score')">Score ↕</button></th> }
      <th><button class="sort" (click)="sortBy('name')">Candidate ↕</button></th>
      <th><button class="sort" (click)="sortBy('title')">Title ↕</button></th>
      <th><button class="sort" (click)="sortBy('company')">Company ↕</button></th><th>Skills</th><th>Job functions</th><th></th>
    </tr></thead><tbody>
      @for (row of sorted(); track row.candidate.id) {
        <tr>
          @if (ranked()) { <td class="muted mono">{{row.rank}}</td><td class="score">{{row.score | number:'1.3-3'}}</td> }
          <td><strong>{{row.candidate.name}}</strong><span class="subtext mono">{{row.candidate.id}}</span></td>
          <td>{{row.candidate.title || '—'}}</td><td>{{row.candidate.company || '—'}}</td>
          <td><div class="tags">@for (skill of row.candidate.skills.slice(0,3); track $index) { <span class="tag">{{skill}}</span> }
            @if (row.candidate.skills.length > 3) { <span class="tag quiet">+{{row.candidate.skills.length - 3}}</span> }
            @if (!row.candidate.skills.length) { <span class="muted">—</span> }</div></td>
          <td class="functions">{{row.candidate.jobFunctions.join(', ') || '—'}}</td>
          <td><button class="button text small" [attr.aria-expanded]="expanded() === row.candidate.id" (click)="expanded.set(expanded() === row.candidate.id ? '' : row.candidate.id)">{{expanded() === row.candidate.id ? 'Close' : 'Details'}}</button></td>
        </tr>
        @if (expanded() === row.candidate.id) {
          <tr class="detail-row"><td [attr.colspan]="ranked() ? 8 : 6"><div class="detail-grid">
            <div><span class="eyebrow">Skills</span><p>{{row.candidate.skills.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Expertise</span><p>{{row.candidate.skillCategories.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Systems</span><p>{{row.candidate.systems.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Industries</span><p>{{row.candidate.industries.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Specializations</span><p>{{row.candidate.subIndustries.join(', ') || 'Not provided'}}</p></div>
            <div><span class="eyebrow">Location / salary</span><p>{{row.candidate.location || '—'}} · {{row.candidate.salary ?? '—'}}</p></div>
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
