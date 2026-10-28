import { Component, effect, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CandidateConsoleStore } from "../candidate-console-store";
import type { ConsoleConfiguration } from "../../../../shared/candidateConsoleContracts";

@Component({ selector: "candidate-settings", standalone: true, imports: [FormsModule], template: `
  <div class="page-heading"><div><span class="eyebrow">Workspace configuration</span><h1>Connect your data.</h1><p>Save the Salesforce and OpenSearch settings you want each operation to use.</p></div>
    <button class="button secondary" (click)="createProfile()">+ New configuration</button></div>
  <form (ngSubmit)="save()" #form="ngForm">
    <section class="card"><div class="section-heading"><div><h2>Configuration</h2><p>Saved locally on this machine. Your existing AWS credentials and Salesforce login are used.</p></div><span class="pill">Local settings</span></div>
      <div class="form-grid"><label class="field">Configuration name<input name="name" [(ngModel)]="draft.name" required maxlength="80" placeholder="Full sandbox" /></label>
        <label class="field">Dataset folder<input name="dataset" [(ngModel)]="draft.dataset" required pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}" placeholder="fsb" /><small>Under .cache/candidates/</small></label></div>
    </section>
    <section class="card"><div class="section-heading"><div><h2>Salesforce & AWS</h2><p>Use the aliases and profiles already configured on this computer.</p></div></div>
      <div class="form-grid three"><label class="field">Salesforce org alias<input name="org" [(ngModel)]="draft.sfOrg" placeholder="full" /></label>
        <label class="field">AWS profile<input name="awsProfile" [(ngModel)]="draft.awsProfile" placeholder="default" /><small>Leave blank to use the default credential chain.</small></label>
        <label class="field">AWS region<input name="region" [(ngModel)]="draft.awsRegion" placeholder="ap-northeast-1" /></label></div>
      <label class="field">OpenSearch collection endpoint<input name="endpoint" [(ngModel)]="draft.endpoint" placeholder="https://your-collection.aoss.ap-northeast-1.on.aws" /></label>
      <label class="field">Candidate record types<input name="recordTypes" [(ngModel)]="draft.sfRecordTypes" placeholder="Candidate,CandidatePreReg" /><small>Comma-separated Salesforce developer names. All statuses are included.</small></label>
      <label class="field">Tag type overrides (JSON)<textarea name="tagTypes" [(ngModel)]="draft.sfTagTypes" rows="3" placeholder="{}"></textarea><small>Map custom tag record-type developer names to skills, skillCategories, systems, industries, subIndustries, jobFunctions, language, or proficiency.</small></label>
      <div class="form-grid"><label class="field">Registered OpenSearch model ID<input name="model" [(ngModel)]="draft.modelId" placeholder="Set after index setup" /></label>
        <label class="field">Bedrock invocation role ARN<input name="role" [(ngModel)]="draft.roleArn" placeholder="arn:aws:iam::123456789012:role/IndexedSearchBedrockRole" /></label></div>
    </section>
    <section class="card"><div class="section-heading"><div><h2>Index & pipelines</h2><p>The default destination for embedding and search. You can choose another index for an individual operation.</p></div></div>
      <label class="field">OpenSearch index<input name="index" [(ngModel)]="draft.index" placeholder="candidates-fsb" /></label>
      <label class="checkbox-line"><input type="checkbox" name="autoPipelines" [(ngModel)]="draft.automaticPipelines" /> Derive pipeline names from the index</label>
      <div class="form-grid"><label class="field">Ingest pipeline<input name="ingest" [ngModel]="draft.automaticPipelines ? draft.index + '-ingest' : draft.ingestPipeline" (ngModelChange)="draft.ingestPipeline = $event" [disabled]="draft.automaticPipelines" /></label>
        <label class="field">Search pipeline<input name="search" [ngModel]="draft.automaticPipelines ? draft.index + '-hybrid' : draft.searchPipeline" (ngModelChange)="draft.searchPipeline = $event" [disabled]="draft.automaticPipelines" /></label></div>
    </section>
    <div class="form-footer"><span class="muted">Running operations keep the settings they started with.</span><button class="button primary" type="submit" [disabled]="!form.valid || saving()">{{saving() ? 'Saving…' : 'Save configuration'}}</button></div>
  </form>
` })
export class CandidateSettingsComponent {
  draft: ConsoleConfiguration;
  readonly saving = signal(false);
  constructor(readonly store: CandidateConsoleStore) {
    this.draft = structuredClone(store.configuration());
    effect(() => { this.draft = structuredClone(store.configuration()); });
  }
  createProfile(): void { this.draft = { ...structuredClone(this.store.configuration()), id: crypto.randomUUID(), name: "New configuration" }; }
  async save(): Promise<void> { this.saving.set(true); await this.store.save(this.draft); this.saving.set(false); }
}
