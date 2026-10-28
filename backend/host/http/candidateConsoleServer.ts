import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { ZodError } from "zod";
import { CandidateConsoleSettingsService } from "../services/candidateConsoleSettingsService";
import { CandidateOperationService } from "../services/candidateOperationService";
import { CandidateDatasetService } from "../services/candidateDatasetService";

export class CandidateConsoleServer {
  private readonly token = randomUUID();
  private readonly streams = new Set<ServerResponse>();
  private port = 0;
  private readonly server = createServer((request, response) => { void this.route(request, response); });
  constructor(private readonly settings: CandidateConsoleSettingsService, private readonly operations: CandidateOperationService,
    private readonly datasets: CandidateDatasetService, private readonly staticRoot: string) {}

  async listen(port = 4310): Promise<number> {
    await new Promise<void>((done, reject) => { this.server.once("error", reject); this.server.listen(port, "127.0.0.1", done); });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Could not start local HTTP server");
    this.port = address.port; return this.port;
  }
  async close(): Promise<void> {
    for (const stream of this.streams) stream.end();
    await new Promise<void>((done, reject) => this.server.close((error) => error ? reject(error) : done()));
    await this.operations.close();
  }
  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    try {
      const allowedHosts = [`127.0.0.1:${this.port}`, `localhost:${this.port}`];
      if (!allowedHosts.includes(request.headers.host ?? "") || (request.headers.origin && !allowedHosts.some((host) => request.headers.origin === `http://${host}`))) {
        this.json(response, 403, { error: "This console accepts requests from its local browser page only." }); return;
      }
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${this.port}`);
      const path = url.pathname;
      if (path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
      if (!["GET", "HEAD"].includes(request.method ?? "") && request.headers["x-console-token"] !== this.token) {
        this.json(response, 403, { error: "Refresh the console before starting an operation." }); return;
      }
      if (request.method === "GET" && path === "/api/session") { this.json(response, 200, { token: this.token }); return; }
      if (request.method === "GET" && path === "/api/settings") { this.json(response, 200, await this.settings.list()); return; }
      if (request.method === "PUT" && path === "/api/settings") { this.json(response, 200, await this.settings.save(await this.body(request))); return; }
      if (request.method === "GET" && path === "/api/datasets") { this.json(response, 200, await this.datasets.datasets()); return; }
      if (request.method === "POST" && path === "/api/batches/list") { this.json(response, 200, await this.datasets.list(await this.body(request))); return; }
      if (request.method === "POST" && path === "/api/batches/preview") { this.json(response, 200, await this.datasets.preview(await this.body(request))); return; }
      if (request.method === "GET" && path === "/api/operations") { this.json(response, 200, this.operations.list()); return; }
      if (request.method === "POST" && path === "/api/operations") { this.json(response, 202, await this.operations.start(await this.body(request))); return; }
      const operation = /^\/api\/operations\/([a-zA-Z0-9-]+)(\/stop)?$/.exec(path);
      if (operation && request.method === "GET" && !operation[2]) { this.json(response, 200, this.operations.get(operation[1])); return; }
      if (operation && request.method === "POST" && operation[2]) { this.json(response, 200, this.operations.stop(operation[1])); return; }
      if (request.method === "GET" && path === "/api/events") { this.events(request, response); return; }
      if (path.startsWith("/api/") || request.method !== "GET") { this.json(response, 404, { error: "Not found" }); return; }
      await this.asset(path, response);
    } catch (error) {
      const message = error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".") || "Request"}: ${issue.message}`).join("; ")
        : error instanceof Error ? error.message : "Request failed";
      if (!response.headersSent) this.json(response, 400, { error: message.slice(0, 4000) }); else response.end();
    }
  }
  private async body(request: IncomingMessage): Promise<unknown> {
    if (!request.headers["content-type"]?.startsWith("application/json")) throw new Error("Use application/json for API requests.");
    const chunks: Buffer[] = []; let length = 0;
    for await (const chunk of request) { length += chunk.length; if (length > 1024 * 1024) throw new Error("Request body is too large."); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  private json(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(body));
  }
  private events(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive", "Cache-Control": "no-cache" });
    this.streams.add(response);
    response.write(`event: snapshot\ndata: ${JSON.stringify(this.operations.list())}\n\n`);
    const unsubscribe = this.operations.subscribe((record) => {
      if (response.writableLength > 1024 * 1024) { response.end(); return; }
      response.write(`event: operation\ndata: ${JSON.stringify(record)}\n\n`);
    });
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 10_000);
    request.on("close", () => { clearInterval(heartbeat); unsubscribe(); this.streams.delete(response); });
  }
  private async asset(path: string, response: ServerResponse): Promise<void> {
    const root = await realpath(this.staticRoot);
    let file = resolve(root, "." + decodeURIComponent(path));
    if (!file.startsWith(root + sep) && file !== root) throw new Error("Invalid asset path");
    if (path === "/" || !extname(path)) file = join(root, "index.html");
    try {
      const actual = await realpath(file);
      if (!actual.startsWith(root + sep) || !(await stat(actual)).isFile()) throw new Error("Invalid asset path");
      const mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
      response.writeHead(200, { "Content-Type": (mime[extname(actual)] ?? "application/octet-stream") + "; charset=utf-8" });
      response.end(await readFile(actual));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; this.json(response, 404, { error: "Asset not found" }); }
  }
}
