import { Component } from "@angular/core";
import { DatePipe } from "@angular/common";
import { CandidateConsoleStore } from "../candidate-console-store";
import { OperationProgressComponent } from "../operation-progress-component";
import { CandidateTableComponent } from "../candidate-table-component";

@Component({ selector: "candidate-activity", standalone: true, imports: [DatePipe, OperationProgressComponent, CandidateTableComponent], template: `
  <div class="page-heading"><div><span class="eyebrow">Run history</span><h1>Activity</h1><p>Inspect progress and results for the latest 100 operations on this machine.</p></div></div>
  <section class="card"><div class="section-heading"><h2>Operations <span class="count">{{store.operations().length}}</span></h2></div>
    @if (store.operations().length) { <div class="table-scroll"><table><thead><tr><th>Operation</th><th>Status</th><th>Configuration</th><th>Dataset / index</th><th>Started</th><th></th></tr></thead><tbody>
    @for (run of store.operations(); track run.id) { <tr [class.selected-row]="store.selected()?.id === run.id"><td class="capitalize"><strong>{{run.kind}}</strong></td><td><span [class]="'status ' + run.status">{{run.status}}</span></td><td>{{run.profileName}}</td><td class="mono">{{run.kind === 'fetch' || run.kind === 'enrich' ? run.dataset : run.index}}</td><td class="muted">{{run.startedAt | date:'MMM d, HH:mm:ss'}}</td><td><button class="button text small" (click)="store.select(run.id)">View run</button></td></tr> }
    </tbody></table></div> } @else { <div class="empty-state"><span class="empty-mark">↗</span><h3>Your operations will appear here</h3><p>Start with a fetch, index setup, or search.</p></div> }
  </section>
  <operation-progress [job]="store.selected()" />
  @if (store.selected(); as run) {
    @if (run.result?.files?.length) { <section class="card"><div class="section-heading"><h2>Completed files</h2><p>Files listed here finished embedding in {{run.index}}.</p></div><div class="table-scroll"><table><thead><tr><th>File</th><th>Indexed</th><th>Skipped</th></tr></thead><tbody>@for (file of run.result!.files!; track file.file) { <tr><td class="mono">{{file.file}}</td><td>{{file.indexed}}</td><td>{{file.skipped}}@if (file.deleted) { <span class="subtext">{{file.deleted}} stale CV documents removed</span> }</td></tr> }</tbody></table></div></section> }
    @if (run.result?.candidates; as candidates) { <section class="card"><div class="section-heading"><h2>{{run.kind === 'enrich' ? 'Demo CV preview · not saved' : 'Search results'}}</h2></div><candidate-table [rows]="candidates" [ranked]="run.kind === 'search'" /></section> }
    <section class="card snapshot-card"><details><summary>Configuration used for this run</summary><dl class="detail-grid"><div><dt>Salesforce org</dt><dd>{{run.request.configuration.sfOrg}}</dd></div><div><dt>AWS profile / region</dt><dd>{{run.request.configuration.awsProfile}} / {{run.request.configuration.awsRegion}}</dd></div><div><dt>Index</dt><dd class="mono">{{run.index}}</dd></div><div><dt>Dataset</dt><dd class="mono">{{run.dataset}}</dd></div><div class="span-all"><dt>Collection endpoint</dt><dd class="mono wrap">{{run.request.configuration.endpoint}}</dd></div><div class="span-all"><dt>Model ID</dt><dd class="mono">{{run.request.configuration.modelId || 'Not set'}}</dd></div></dl></details></section>
  }
` })
export class CandidateActivityComponent { constructor(readonly store: CandidateConsoleStore) {} }
