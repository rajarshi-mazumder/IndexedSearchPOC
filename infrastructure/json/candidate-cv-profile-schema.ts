import { z } from "zod";

const text = z.string().min(1).max(4000);
const list = z.array(text).max(50);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const candidateCvProfileSchema = z.object({
  source: z.object({ kind: z.literal("synthetic"), generatorVersion: z.literal(1), seed: text, archetype: text }).strict(),
  summary: text,
  technicalSkills: z.object({ languages: list, frameworks: list, databases: list, tools: list }).strict(),
  employmentHistory: z.array(z.object({ employer: text, role: text, location: text, start: month, end: month, responsibilities: list }).strict()
    .refine((item) => item.start <= item.end, "Employment must end after it starts")).max(20),
  projects: z.array(z.object({ name: text, description: text, role: text, technologies: list, contributions: list }).strict()).max(20),
  education: z.array(z.object({ qualification: text, institution: text, graduationYear: z.number().int().min(1950).max(2100) }).strict()).max(20),
  certifications: z.array(z.object({ name: text, issuer: text, year: z.number().int().min(1950).max(2100) }).strict()).max(20),
  languages: z.array(z.object({ language: text, level: text }).strict()).max(30),
}).strict();
