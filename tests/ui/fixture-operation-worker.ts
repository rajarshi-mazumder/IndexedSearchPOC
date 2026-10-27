// An IPC-only fixture: never authenticates or contacts an external service.
import "../../bootstrap";
process.on("message", (message: { type: string }) => {
  if (message.type === "start") process.send?.({ type: "progress", progress: { message: `${process.env.AWS_PROFILE}:${process.env.OPENSEARCH_INDEX}` } });
  if (message.type === "stop") { process.send?.({ type: "result", result: {}, cancelled: true }); process.disconnect(); }
});
