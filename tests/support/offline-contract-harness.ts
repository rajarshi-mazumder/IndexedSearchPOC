import assert from "node:assert/strict";
import { execFile, fork, ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import configuration from "../e2e/fixtures/input/configuration.json";

const runFile = promisify(execFile);
export class OfflineContractHarness {
  readonly configuration = structuredClone(configuration);
  readonly outputs: Record<string, string> = {};
  private server?: ChildProcess;
  private url = "";
  private token = "";
  private requestOffset = 0;
  private constructor(readonly workspace: string) {}
  static async create() {
    const harness = new OfflineContractHarness(await mkdtemp(join(tmpdir(), "indexed-contract-")));
    try { await harness.start(); return harness; } catch (error) { await harness.close(); throw error; }
  }
  async start(): Promise<void> {
    let errors = "";
    const child = this.server = fork(resolve(__dirname, "offline-contract-server.ts"), [], {
      cwd: this.workspace, env: { ...process.env, TZ: "UTC", AWS_EC2_METADATA_DISABLED: "true" },
      execArgv: ["--import", pathToFileURL(require.resolve("tsx")).href], windowsHide: true, stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    child.stderr!.on("data", (data) => { errors += String(data); });
    const port = await new Promise<number>((done, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error("Contract server startup timed out: " + errors)); }, 15000);
      child.once("message", (message: any) => { clearTimeout(timer); done(message.port); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error(errors)); });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
    this.url = `http://127.0.0.1:${port}`;
    this.token = (await this.api("GET", "/api/session")).body.token;
  }
  async stopServer() {
    const child = this.server;
    if (!child || child.exitCode !== null) return;
    await new Promise<void>((done) => {
      const timer = setTimeout(() => { child.kill(); }, 8000);
      child.once("exit", () => { clearTimeout(timer); done(); });
      if (child.connected) child.send({ type: "close" }); else child.kill();
    });
  }
  async close() {
    await this.stopServer();
    assert.ok(resolve(this.workspace).startsWith(resolve(tmpdir()) + sep) && this.workspace.includes("indexed-contract-"));
    await rm(this.workspace, { recursive: true, force: true });
  }
  async api(method: string, path: string, body?: unknown) {
    const response = await fetch(this.url + path, { method, headers: { "Content-Type": "application/json", "x-console-token": this.token },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  async startOperation(request: Record<string, unknown>) {
    const response = await this.api("POST", "/api/operations", { configuration: this.configuration, ...request });
    assert.equal(response.status, 202, JSON.stringify(response.body));
    return response.body.id as string;
  }
  async wait(id: string) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const response = await this.api("GET", "/api/operations/" + id);
      assert.equal(response.status, 200);
      if (!["running", "stopping"].includes(response.body.status)) return response.body;
      await new Promise((done) => setTimeout(done, 25));
    }
    throw new Error("Operation timed out: " + id);
  }
  async operation(name: string, request: Record<string, unknown>, expectedStatus = "succeeded") {
    const result = await this.wait(await this.startOperation(request));
    assert.equal(result.status, expectedStatus, result.error ?? name);
    this.recordOperation(name, result);
    await this.recordRequests(name);
    return result;
  }
  recordOperation(name: string, operation: any) {
    // No transformation of business content. Only volatile operation-envelope
    // IDs/times and OS-assigned mtimes are excluded; application time is fixed.
    const result = structuredClone(operation.result);
    for (const file of result?.files ?? []) delete file.modifiedAt;
    this.record(name + ".operation.json", { kind: operation.kind, status: operation.status, request: operation.request,
      progress: operation.progress, result, error: operation.error, messages: operation.events.map((event: any) => event.message) });
  }
  async recordRequests(name: string) {
    const bytes = await this.read("boundary-requests.jsonl").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return ""; throw error; });
    this.outputs[name + ".requests.jsonl"] = bytes.slice(this.requestOffset);
    this.requestOffset = bytes.length;
  }
  record(name: string, value: unknown) { this.outputs[name] = JSON.stringify(value, null, 2) + "\n"; }
  async read(path: string) { return readFile(join(this.workspace, path), "utf8"); }
  async capture(name: string, path: string) { this.outputs[name] = await this.read(path); }
  async fault(value: unknown) { await writeFile(join(this.workspace, "fault.json"), JSON.stringify(value)); }
  async cli(command: "index" | "search", args: string[], expectedFailure = false) {
    const environment = { ...process.env, AWS_REGION: "ap-northeast-1", AWS_PROFILE: "fixture", AWS_EC2_METADATA_DISABLED: "true",
      OPENSEARCH_NODE: configuration.endpoint, OPENSEARCH_MODEL_ID: configuration.modelId, OPENSEARCH_INDEX: configuration.index,
      OPENSEARCH_INGEST_PIPELINE: configuration.index + "-ingest", OPENSEARCH_SEARCH_PIPELINE: configuration.index + "-hybrid" };
    try {
      const result = await runFile(process.execPath, ["--import", pathToFileURL(require.resolve("tsx")).href,
        resolve(__dirname, "offline-contract-cli.ts"), command, ...args], { cwd: this.workspace, env: environment, windowsHide: true, timeout: 20000 });
      assert.equal(expectedFailure, false, "Expected CLI failure");
      return result.stdout;
    } catch (error: any) { if (expectedFailure && typeof error.stderr === "string") return error.stderr; throw error; }
  }
}
