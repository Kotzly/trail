import { createClient } from "@sanity/client";

export const projectId = process.env.SANITY_PROJECT_ID ?? "";
export const dataset = process.env.SANITY_DATASET ?? "production";
export const apiVersion = "2025-06-01";

export const client = projectId
  ? createClient({ projectId, dataset, apiVersion, useCdn: true })
  : null;
