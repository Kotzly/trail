import { z } from "zod";

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

/** GET /api/v1/oauth/authorize — query params */
export const oauthAuthorizeQuerySchema = z.object({
  response_type: z.string().default("code"),
  client_id: z.string().default("trail-extension"),
  redirect_uri: z.string().default(""),
  state: z.string().nullish(),
  scope: z.string().nullish(),
  code_challenge: z.string().default(""),
  code_challenge_method: z.string().default("S256"),
  prompt: z.string().default(""),
  device_id: z.string().nullish(),
});

/** POST /api/v1/oauth/token — request body */
export const oauthTokenBodySchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    client_id: z.string().default("trail-extension"),
    code: z.string(),
    code_verifier: z.string(),
    redirect_uri: z.string(),
    device_id: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    client_id: z.string().default("trail-extension"),
    refresh_token: z.string(),
  }),
]);

/** POST /api/v1/oauth/revoke — request body */
export const oauthRevokeBodySchema = z.object({
  refresh_token: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Trails
// ---------------------------------------------------------------------------

/** GET /api/v1/trails — query params */
export const trailsListQuerySchema = z.object({
  // Reject bad input instead of silently defaulting to 50 — previously
  // `?limit=-5` / `?limit=abc` / `?limit=99999` all collapsed to 50 with
  // no error surfaced, making the API contract untestable (closes P2.28).
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().nullish(),
  includeDeleted: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const labelSourceSchema = z.enum(["user", "auto", "system"]);

/** PUT /api/v1/trails/[id] — full upsert body */
export const trailPutBodySchema = z.object({
  deviceId: z.string().min(1),
  label: z.string().min(1),
  labelSource: labelSourceSchema,
  labelUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  savedAt: z.string().datetime(),
  nodeCount: z.number().int().nonnegative(),
  rootUrl: z.string().nullable().optional(),
  rootTitle: z.string().nullable().optional(),
  rootFavicon: z.string().nullable().optional(),
  payload: z.unknown(),
  deletedAt: z.string().datetime().nullable().optional(),
  trailDeviceId: z.string().optional(),
});

/** PATCH /api/v1/trails/[id] — partial update body */
export const trailPatchBodySchema = z
  .object({
    label: z.string().optional(),
    labelSource: labelSourceSchema.optional(),
    deletedAt: z.string().datetime().nullable().optional(),
    payload: z.unknown().optional(),
    nodeCount: z.number().int().nonnegative().optional(),
    rootUrl: z.string().nullable().optional(),
    rootTitle: z.string().nullable().optional(),
    rootFavicon: z.string().nullable().optional(),
    savedAt: z.string().datetime().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided.",
  });

// ---------------------------------------------------------------------------
// Trails Sync
// ---------------------------------------------------------------------------

/** POST /api/v1/trails/sync — request body */
export const trailsSyncBodySchema = z.object({
  deviceId: z.string().min(1),
  clientSyncAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Trails Import
// ---------------------------------------------------------------------------

const treeNodeSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      data: z.record(z.string(), z.unknown()).optional(),
      children: z.array(treeNodeSchema).optional(),
    })
    .passthrough(),
);

const treePayloadSchema = z
  .object({
    root: treeNodeSchema,
    nodeCount: z.number(),
  })
  .passthrough();

const importSourceSchema = z
  .object({
    treeLabel: z.string().optional(),
  })
  .passthrough()
  .optional();

/** POST /api/v1/trails/import — request body (TrailExportBundle) */
export const trailsImportBodySchema = z.object({
  schema: z.literal("trail.export.v1"),
  tree: treePayloadSchema,
  source: importSourceSchema,
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/** POST /api/v1/subscription/checkout — request body */
export const subscriptionCheckoutBodySchema = z.object({
  planId: z.enum(["pro", "teams"]),
  interval: z.enum(["month", "year"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** POST /api/v1/onboarding — request body */
export const onboardingBodySchema = z.object({
  action: z.enum(["complete", "skip"]),
});
