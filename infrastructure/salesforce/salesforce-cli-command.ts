import { execFileSync } from "node:child_process";
import { z } from "zod";

const argumentsSchema = z.array(z.string().regex(/^[a-zA-Z0-9_.@+-]+$/));

export class SalesforceCliCommand {
  execute(args: string[]): string {
    const safeArgs = argumentsSchema.parse(args);
    // Windows installs sf as a .cmd wrapper, which requires cmd.exe.
    if (process.platform === "win32") {
      return execFileSync("cmd.exe", ["/d", "/s", "/c", ["sf", ...safeArgs].join(" ")], {
        encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], windowsHide: true,
      });
    }
    return execFileSync("sf", safeArgs, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  }
}
