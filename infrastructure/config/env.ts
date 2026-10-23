import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  SF_TARGET_ORG: z.literal("rajarshi"),
});

export const env = schema.parse(process.env);
