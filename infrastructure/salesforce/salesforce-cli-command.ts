import { execFileSync } from "node:child_process";
import { z } from "zod";

const argumentsSchema = z.array(z.string().regex(/^[a-zA-Z0-9_.@+-]+$/));

export class SalesforceCliCommand {
  execute(args: string[]): string {
    const safeArgs = argumentsSchema.parse(args);
    try {
      // Windows installs sf as a .cmd wrapper, which requires cmd.exe.
      const executable = process.platform === "win32" ? "cmd.exe" : "sf";
      const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", ["sf", ...safeArgs].join(" ")] : safeArgs;
      return execFileSync(executable, commandArgs, {
        encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], windowsHide: true, timeout: 120_000,
      });
    } catch (error) {
      // Child process errors can include stdout containing the access token.
      const timeout = (error as NodeJS.ErrnoException).code === "ETIMEDOUT";
      throw new Error(timeout ? "Salesforce CLI authentication timed out after 120 seconds. Check the org login and retry."
        : "Salesforce CLI authentication failed. Verify the selected org with sf org list, then log in again if needed.");
    }
  }
}
