import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { OpenSearchServerlessClient } from "../backend/infrastructure/opensearch/openSearchServerlessClient";

test("the real SDK signs requests for aoss and includes the payload hash", async () => {
  let captured: { authorization?: string; hash?: string; body: string } | undefined;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    captured = {
      authorization: request.headers.authorization,
      hash: request.headers["x-amz-content-sha256"] as string | undefined,
      body: Buffer.concat(chunks).toString(),
    };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ acknowledged: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const client = new OpenSearchServerlessClient({
    AWS_REGION: "ap-northeast-1", OPENSEARCH_NODE: "http://127.0.0.1:" + port,
  }, async () => ({ accessKeyId: "OFFLINE_TEST", secretAccessKey: "offline-test-only" })).connection;
  try {
    await client.transport.request({ method: "POST", path: "/_search", body: { query: { match_all: {} } } });
    assert.match(captured!.authorization!, /ap-northeast-1\/aoss\/aws4_request/);
    assert.equal(captured!.hash, createHash("sha256").update(captured!.body).digest("hex"));
    assert.deepEqual(JSON.parse(captured!.body), { query: { match_all: {} } });
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
