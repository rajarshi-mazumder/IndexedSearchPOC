import { fullIndexCandidates } from "../../bootstrap";

async function main() {
  await fullIndexCandidates.execute();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
