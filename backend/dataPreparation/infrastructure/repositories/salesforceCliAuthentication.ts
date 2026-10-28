import { Connection } from "jsforce";
import { z } from "zod";

type SfCommandRunner = (args: string[]) => string;

const orgResponse = z.object({
  status: z.literal(0),
  result: z.object({
    instanceUrl: z.string().url(),
    id: z.string().optional()
  }),
});

const tokenResponse = z.object({
  status: z.literal(0),
  result: z.object({
    accessToken: z.string().min(1)
  }),
});

export class SalesforceCliAuthentication {
  public constructor(private readonly targetOrg: string, private readonly runCommand: SfCommandRunner) { }

  public createConnection(): Connection {
    const session = this.createSession();
    return session.connection;
  }

  public createSession(): {
    connection: Connection;
    sourceId: string;
  } {
    const org = this.readOrgDetails();
    const token = this.readAccessToken();
    let sourceId = org.result.id;
    if (sourceId == null) {
      sourceId = org.result.instanceUrl;
    }
    return {
      connection: new Connection({
        instanceUrl: org.result.instanceUrl,
        accessToken: token.result.accessToken
      }),
      sourceId,
    };
  }

  private readOrgDetails(): z.infer<typeof orgResponse> {
    const output = this.runCommand(["org", "display", "--target-org", this.targetOrg, "--json"]);
    return orgResponse.parse(JSON.parse(output));
  }

  private readAccessToken(): z.infer<typeof tokenResponse> {
    const output = this.runCommand(["org", "auth", "show-access-token", "--json", "-o", this.targetOrg]);
    return tokenResponse.parse(JSON.parse(output));
  }
}
