import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { CandidateConsoleComponent } from "./app/candidate-console-component";
bootstrapApplication(CandidateConsoleComponent, { providers: [provideHttpClient()] }).catch(console.error);
