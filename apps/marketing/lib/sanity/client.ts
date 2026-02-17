import { createClient } from "@sanity/client";

export const projectId = process.env.SANITY_PROJECT_ID!;
export const dataset = process.env.SANITY_DATASET!;
export const apiVersion = "2025-06-01";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});
