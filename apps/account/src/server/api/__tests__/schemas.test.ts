import { describe, it, expect } from "vitest";
import {
  oauthAuthorizeQuerySchema,
  oauthTokenBodySchema,
  oauthRevokeBodySchema,
  trailsListQuerySchema,
  trailPutBodySchema,
  trailPatchBodySchema,
  trailsSyncBodySchema,
  trailsImportBodySchema,
  subscriptionCheckoutBodySchema,
  onboardingBodySchema,
} from "@/src/server/api/schemas";

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

describe("oauthAuthorizeQuerySchema", () => {
  it("accepts valid input with all fields", () => {
    const result = oauthAuthorizeQuerySchema.safeParse({
      response_type: "code",
      client_id: "trail-extension",
      redirect_uri: "https://example.com/callback",
      state: "abc123",
      scope: "read",
      code_challenge: "challenge",
      code_challenge_method: "S256",
      prompt: "login",
      device_id: "dev-1",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for missing optional fields", () => {
    const result = oauthAuthorizeQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.response_type).toBe("code");
      expect(result.data.client_id).toBe("trail-extension");
      expect(result.data.redirect_uri).toBe("");
      expect(result.data.code_challenge).toBe("");
      expect(result.data.code_challenge_method).toBe("S256");
      expect(result.data.prompt).toBe("");
    }
  });

  it("allows nullish state and scope", () => {
    const result = oauthAuthorizeQuerySchema.safeParse({
      state: null,
      scope: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe("oauthTokenBodySchema", () => {
  it("accepts authorization_code grant", () => {
    const result = oauthTokenBodySchema.safeParse({
      grant_type: "authorization_code",
      code: "auth-code-123",
      code_verifier: "verifier-456",
      redirect_uri: "https://example.com/callback",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.client_id).toBe("trail-extension");
    }
  });

  it("accepts refresh_token grant", () => {
    const result = oauthTokenBodySchema.safeParse({
      grant_type: "refresh_token",
      refresh_token: "rt-789",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.client_id).toBe("trail-extension");
    }
  });

  it("rejects unknown grant_type", () => {
    const result = oauthTokenBodySchema.safeParse({
      grant_type: "password",
      username: "user",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects authorization_code without required code", () => {
    const result = oauthTokenBodySchema.safeParse({
      grant_type: "authorization_code",
      code_verifier: "verifier",
      redirect_uri: "https://example.com/callback",
    });
    expect(result.success).toBe(false);
  });

  it("rejects refresh_token without refresh_token field", () => {
    const result = oauthTokenBodySchema.safeParse({
      grant_type: "refresh_token",
    });
    expect(result.success).toBe(false);
  });
});

describe("oauthRevokeBodySchema", () => {
  it("accepts body with refresh_token", () => {
    const result = oauthRevokeBodySchema.safeParse({
      refresh_token: "rt-abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty body (refresh_token is optional)", () => {
    const result = oauthRevokeBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-string refresh_token", () => {
    const result = oauthRevokeBodySchema.safeParse({
      refresh_token: 123,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trails
// ---------------------------------------------------------------------------

describe("trailsListQuerySchema", () => {
  it("applies default limit of 50 when not provided", () => {
    const result = trailsListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.includeDeleted).toBe(false);
    }
  });

  it("transforms valid string limit to number", () => {
    const result = trailsListQuerySchema.safeParse({ limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("clamps limit exceeding 200 to default 50", () => {
    const result = trailsListQuerySchema.safeParse({ limit: "999" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("clamps non-positive limit to default 50", () => {
    const result = trailsListQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("clamps non-numeric limit to default 50", () => {
    const result = trailsListQuerySchema.safeParse({ limit: "abc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("transforms includeDeleted 'true' to boolean true", () => {
    const result = trailsListQuerySchema.safeParse({ includeDeleted: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeDeleted).toBe(true);
    }
  });

  it("transforms includeDeleted 'false' to boolean false", () => {
    const result = trailsListQuerySchema.safeParse({ includeDeleted: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeDeleted).toBe(false);
    }
  });
});

const validTrailPut = {
  deviceId: "device-1",
  label: "My Trail",
  labelSource: "user" as const,
  labelUpdatedAt: "2024-01-01T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  savedAt: "2024-01-01T00:00:00Z",
  nodeCount: 5,
};

describe("trailPutBodySchema", () => {
  it("accepts valid full trail body", () => {
    const result = trailPutBodySchema.safeParse(validTrailPut);
    expect(result.success).toBe(true);
  });

  it("accepts optional nullable fields", () => {
    const result = trailPutBodySchema.safeParse({
      ...validTrailPut,
      rootUrl: "https://example.com",
      rootTitle: "Example",
      rootFavicon: "https://example.com/favicon.ico",
      deletedAt: null,
      payload: { some: "data" },
      trailDeviceId: "td-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty deviceId", () => {
    const result = trailPutBodySchema.safeParse({
      ...validTrailPut,
      deviceId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid labelSource", () => {
    const result = trailPutBodySchema.safeParse({
      ...validTrailPut,
      labelSource: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-datetime string for createdAt", () => {
    const result = trailPutBodySchema.safeParse({
      ...validTrailPut,
      createdAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative nodeCount", () => {
    const result = trailPutBodySchema.safeParse({
      ...validTrailPut,
      nodeCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = trailPutBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("trailPatchBodySchema", () => {
  it("accepts partial update with label", () => {
    const result = trailPatchBodySchema.safeParse({ label: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts setting deletedAt to null (restore)", () => {
    const result = trailPatchBodySchema.safeParse({ deletedAt: null });
    expect(result.success).toBe(true);
  });

  it("accepts setting deletedAt to datetime (soft delete)", () => {
    const result = trailPatchBodySchema.safeParse({
      deletedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    const result = trailPatchBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects invalid labelSource value", () => {
    const result = trailPatchBodySchema.safeParse({ labelSource: "bad" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trails Sync
// ---------------------------------------------------------------------------

describe("trailsSyncBodySchema", () => {
  it("accepts valid sync body", () => {
    const result = trailsSyncBodySchema.safeParse({
      deviceId: "dev-1",
      clientSyncAt: "2024-06-01T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty deviceId", () => {
    const result = trailsSyncBodySchema.safeParse({
      deviceId: "",
      clientSyncAt: "2024-06-01T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for clientSyncAt", () => {
    const result = trailsSyncBodySchema.safeParse({
      deviceId: "dev-1",
      clientSyncAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = trailsSyncBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trails Import
// ---------------------------------------------------------------------------

describe("trailsImportBodySchema", () => {
  it("accepts valid import body", () => {
    const result = trailsImportBodySchema.safeParse({
      schema: "trail.export.v1",
      tree: {
        root: { data: { url: "https://example.com" }, children: [] },
        nodeCount: 1,
      },
      source: { treeLabel: "Imported Trail" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts nested tree children", () => {
    const result = trailsImportBodySchema.safeParse({
      schema: "trail.export.v1",
      tree: {
        root: {
          data: { url: "https://a.com" },
          children: [
            {
              data: { url: "https://b.com" },
              children: [{ data: { url: "https://c.com" } }],
            },
          ],
        },
        nodeCount: 3,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrong schema literal", () => {
    const result = trailsImportBodySchema.safeParse({
      schema: "trail.export.v2",
      tree: { root: {}, nodeCount: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing tree", () => {
    const result = trailsImportBodySchema.safeParse({
      schema: "trail.export.v1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects tree without nodeCount", () => {
    const result = trailsImportBodySchema.safeParse({
      schema: "trail.export.v1",
      tree: { root: {} },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe("subscriptionCheckoutBodySchema", () => {
  it("accepts valid checkout with pro/month", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({
      planId: "pro",
      interval: "month",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid checkout with teams/year and URLs", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({
      planId: "teams",
      interval: "year",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid planId", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({
      planId: "enterprise",
      interval: "month",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid interval", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({
      planId: "pro",
      interval: "weekly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL for successUrl", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({
      planId: "pro",
      interval: "month",
      successUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = subscriptionCheckoutBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

describe("onboardingBodySchema", () => {
  it("accepts 'complete' action", () => {
    const result = onboardingBodySchema.safeParse({ action: "complete" });
    expect(result.success).toBe(true);
  });

  it("accepts 'skip' action", () => {
    const result = onboardingBodySchema.safeParse({ action: "skip" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown action", () => {
    const result = onboardingBodySchema.safeParse({ action: "reset" });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = onboardingBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
