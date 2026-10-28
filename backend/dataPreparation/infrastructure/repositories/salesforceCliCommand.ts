import { execFileSync } from "node:child_process";
import { z } from "zod";

const argumentsSchema = z.array(z.string().regex(/^[a-zA-Z0-9_.@+-]+$/));

export class SalesforceCliCommand {
  public execute(args: string[]): string {
    const safeArgs = argumentsSchema.parse(args);
    try {
      return this.executeAuthenticationCommand(safeArgs);
    }
    catch (error) {
      throw this.createSafeAuthenticationError(error);
    }
  }

  private executeAuthenticationCommand(args: string[]): string {
    let executable = "sf";
    let commandArgs = args;
    if (process.platform === "win32") {
      // Windows installs sf as a .cmd wrapper, which requires cmd.exe.
      executable = "cmd.exe";
      commandArgs = ["/d", "/s", "/c", ["sf", ...args].join(" ")];
    }
    return execFileSync(executable, commandArgs, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
      timeout: 120000,
    });
  }

  private createSafeAuthenticationError(error: unknown): Error {
    // Child process errors can contain access tokens, so never forward their output.
    if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
      return new Error("Salesforce CLI authentication timed out after 120 seconds. Check the org login and retry.");
    }
    return new Error("Salesforce CLI authentication failed. Verify the selected org with sf org list, then log in again if needed.");
  }
}
