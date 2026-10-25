import { createSearchContext } from "../../bootstrap";

async function main() {
  const query = process.argv.slice(2).join(" ").trim() || "Business analysis experience";
  const context = createSearchContext();
  try {
    console.log('Query: "' + query + '"\n');
    const results = await context.searchCandidates.execute(query, 10);
    for (const [index, result] of results.entries()) {
      const candidate = result.document.candidate;
      console.log("-".repeat(80));
      console.log("#" + (index + 1));
      console.log("Hybrid Score:", result.score.toFixed(6));
      console.log("Name:", candidate.name);
      console.log("Skills:", candidate.skills.join(", "));
      console.log("Job Functions:", candidate.jobFunctions.join(", "));
    }
    if (!results.length) console.log("No candidates found.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Search failed");
  process.exitCode = 1;
});
