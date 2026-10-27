import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "./candidate-console-store";
import { CandidateSettingsComponent } from "./settings/candidate-settings-component";
import { CandidateFetchComponent } from "./fetch/candidate-fetch-component";
import { CandidateEmbedComponent } from "./embed/candidate-embed-component";
import { CandidateSearchComponent } from "./search/candidate-search-component";
import { CandidateActivityComponent } from "./activity/candidate-activity-component";

@Component({ selector: "candidate-console", standalone: true, imports: [FormsModule, CandidateSettingsComponent, CandidateFetchComponent, CandidateEmbedComponent, CandidateSearchComponent, CandidateActivityComponent], template: `
  <div class="app-shell"><aside class="sidebar"><a class="brand" href="/" aria-label="Candidate Console home"><span class="brand-mark">c<span>·</span></span><span>Candidate<strong>Console</strong></span></a><div class="sidebar-label">WORKSPACE</div>
    <nav aria-label="Main navigation">@for (item of navigation; track item.id) { <button [class.active]="tab() === item.id" [attr.aria-current]="tab() === item.id ? 'page' : null" (click)="tab.set(item.id)"><span class="nav-icon" aria-hidden="true">{{item.icon}}</span>{{item.label}}@if (item.id === 'activity' && runningCount()) { <span class="nav-count" aria-hidden="true">{{runningCount()}}</span> }</button> }</nav>
    <div class="sidebar-bottom"><div class="connection"><span class="dot" [class.online]="store.connected()"></span>{{store.connected() ? 'Local server connected' : 'Connecting to server…'}}</div><p>Salesforce → OpenSearch<br/>Your data, one batch at a time.</p></div>
  </aside><div class="main-shell"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span> {{title()}}</div><div class="profile-picker"><label for="profile-select">Configuration</label><select id="profile-select" [ngModel]="store.configuration().id" (ngModelChange)="store.chooseProfile($event)">@for (profile of store.profiles(); track profile.id) { <option [value]="profile.id">{{profile.name}}</option> }</select></div></header>
    <main>@if (store.error()) { <div class="alert error" role="alert"><span>{{store.error()}}</span><button aria-label="Dismiss error" (click)="store.error.set('')">×</button></div> }
      @if (store.notice()) { <div class="alert success" role="status"><span>{{store.notice()}}</span><button aria-label="Dismiss notification" (click)="store.notice.set('')">×</button></div> }
      @if (store.ready()) { @switch (tab()) { @case ('settings') { <candidate-settings /> } @case ('fetch') { <candidate-fetch /> } @case ('embed') { <candidate-embed /> } @case ('search') { <candidate-search /> } @case ('activity') { <candidate-activity /> } } }
      @else { <div class="empty-state"><h1>Loading your workspace…</h1><p>Connecting to the local candidate console.</p></div> }
    </main><footer class="app-footer"><span>Candidate Console</span><span>Local workspace · {{store.configuration().awsRegion}}</span></footer></div></div>
` })
export class CandidateConsoleComponent {
  readonly tab = signal("fetch");
  readonly navigation = [{ id: "settings", label: "Configuration", icon: "⚙" }, { id: "fetch", label: "Fetch candidates", icon: "↓" }, { id: "embed", label: "Embed & index", icon: "◈" }, { id: "search", label: "Search candidates", icon: "⌕" }, { id: "activity", label: "Activity", icon: "≋" }];
  constructor(readonly store: CandidateConsoleStore) { void store.initialize(); }
  title(): string { return this.navigation.find((item) => item.id === this.tab())!.label; }
  runningCount(): number { return this.store.operations().filter((run) => this.store.active(run)).length; }
}
