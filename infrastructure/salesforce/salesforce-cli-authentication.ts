import { Connection } from "jsforce";
import { z } from "zod";

type SfCommandRunner = (args: string[]) => string;
const orgResponse = z.object({
  status: z.literal(0),
  result: z.object({ instanceUrl: z.string().url() }),
});
const tokenResponse = z.object({
  status: z.literal(0),
  result: z.object({ accessToken: z.string().min(1) }),
});

export class SalesforceCliAuthentication {
  constructor(
    private readonly targetOrg: string,
    private readonly runCommand: SfCommandRunner,
  ) {}

  createConnection(): Connection {
    const org = orgResponse.parse(JSON.parse(
      this.runCommand(["org", "display", "--target-org", this.targetOrg, "--json"]),
    ));
    const token = tokenResponse.parse(JSON.parse(
      this.runCommand(["org", "auth", "show-access-token", "--json", "-o", this.targetOrg]),
    ));
    return new Connection({ instanceUrl: org.result.instanceUrl, accessToken: token.result.accessToken });
  }
}
