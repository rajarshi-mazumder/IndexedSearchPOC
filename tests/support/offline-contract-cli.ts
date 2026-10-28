import "./offline-contract-adapters";
import { indexingCliModule, searchCliModule } from "./current-backend-bindings";
const command = process.argv.splice(2, 1)[0];
if (command !== "index" && command !== "search") throw new Error("Unknown test CLI");
require(command === "index" ? indexingCliModule : searchCliModule);
