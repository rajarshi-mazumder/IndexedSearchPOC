import dotenv from "dotenv";
import jsforce, { Connection } from "jsforce";
import { execSync } from "child_process";

dotenv.config();

type OrgDisplayResult = {
  result: {
    instanceUrl: string;
  };
};

type AccessTokenResult = {
  result: {
    accessToken: string;
  };
};

export class SforceAuthService {
  public static createConnection(): Connection {
    const targetOrg = "rajarshi";
    if (!targetOrg) {
      throw new Error("SF_TARGET_ORG environment variable is not set");
    }
    return SforceAuthService.getAuthData(targetOrg);
  }

  private static getAuthData(targetOrg: string): Connection {
    const orgInfo = SforceAuthService.executeSfCommand<OrgDisplayResult>(
      `sf org display --target-org ${targetOrg} --json`,
    );
    const tokenInfo = SforceAuthService.executeSfCommand<AccessTokenResult>(
      `sf org auth show-access-token --json -o ${targetOrg}`,
    );
    return new jsforce.Connection({
      instanceUrl: orgInfo.result.instanceUrl,
      accessToken: tokenInfo.result.accessToken,
    });
  }

  private static executeSfCommand<T>(command: string): T {
    return JSON.parse(
      execSync(command, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }),
    );
  }
}
