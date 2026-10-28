import { Component, input } from "@angular/core";
import { KeyValuePipe } from "@angular/common";
import type { CandidateCvProfile } from "../../../../shared/domain/models/candidateCvProfile";

@Component({ selector: "candidate-cv-details", standalone: true, imports: [KeyValuePipe], template: `
  <section class="cv-details"><h3>Demo CV <span class="status stopping">Synthetic</span></h3>
    <p class="muted">Generated example · {{cv().source.archetype}} · seed {{cv().source.seed}} · version {{cv().source.generatorVersion}}</p>
    <p>{{cv().summary}}</p><div class="detail-grid">
      <div><span class="eyebrow">Technical skills</span>
        @for (group of cv().technicalSkills | keyvalue; track group.key) { @if (group.value.length) { <p><strong>{{group.key}}:</strong> {{group.value.join(', ')}}</p> } }
      </div>
      <div><span class="eyebrow">Spoken languages</span>@for (language of cv().languages; track $index) { <p>{{language.language}} · {{language.level}}</p> }</div>
      <div class="span-all"><span class="eyebrow">Employment history</span>
        @for (job of cv().employmentHistory; track $index) { <h4>{{job.role}} · {{job.employer}}</h4><p>{{job.start}} — {{job.end}} · {{job.location}}</p><ul>@for (item of job.responsibilities; track $index) { <li>{{item}}</li> }</ul> }
      </div>
      <div class="span-all"><span class="eyebrow">Projects</span>
        @for (project of cv().projects; track $index) { <h4>{{project.name}}</h4><p>{{project.description}}</p><p>{{project.role}} · {{project.technologies.join(', ')}}</p><ul>@for (item of project.contributions; track $index) { <li>{{item}}</li> }</ul> }
      </div>
      <div><span class="eyebrow">Education</span>@for (item of cv().education; track $index) { <p>{{item.qualification}} · {{item.institution}} · {{item.graduationYear}}</p> }</div>
      <div><span class="eyebrow">Certifications / training</span>@for (item of cv().certifications; track $index) { <p>{{item.name}} · {{item.issuer}} · {{item.year}}</p> }</div>
    </div>
  </section>
` })
export class CandidateCvDetailsComponent { readonly cv = input.required<CandidateCvProfile>(); }
