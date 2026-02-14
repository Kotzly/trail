import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { ensureUser } from "@/src/server/backend/user";
import { upsertWishlistLead } from "@/src/server/backend/wishlist";

export const runtime = "nodejs";

type WishlistSourceInput = "marketing" | "account" | "extension";
type WishlistSource = "MARKETING" | "ACCOUNT" | "EXTENSION";

const sourceMap: Record<WishlistSourceInput, WishlistSource> = {
  marketing: "MARKETING",
  account: "ACCOUNT",
  extension: "EXTENSION",
};

function normalizeSource(value: unknown): WishlistSource | null {
  if (typeof value !== "string") {
    return null;
  }
  const lowered = value.trim().toLowerCase() as WishlistSourceInput;
  return sourceMap[lowered] ?? null;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function mapSourceOutput(value: string): WishlistSourceInput {
  switch (value) {
    case "MARKETING":
      return "marketing";
    case "ACCOUNT":
      return "account";
    case "EXTENSION":
      return "extension";
    default:
      return "extension";
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return jsonError("email_required", "Email is required.", { status: 400 });
  }

  const rawSource = body?.source;
  const source = normalizeSource(rawSource);
  if (!source) {
    const isString = typeof rawSource === "string";
    const code = isString ? "invalid_source" : "source_required";
    const message = isString ? "Invalid source." : "Source is required.";
    return jsonError(code, message, { status: 400 });
  }

  const token = getBearerToken(request.headers);
  let userId: string | null | undefined = undefined;

  if (token) {
    const authUser = await verifyUserToken(token);
    if (authUser) {
      const user = await ensureUser(authUser);
      userId = user?.id ?? null;
    } else {
      const extension = await verifyExtensionToken(token);
      if (extension) {
        userId = extension.sub;
      }
    }
  }

  const lead = await upsertWishlistLead({
    email,
    source,
    userId,
    utmSource: normalizeNullableString(body?.utmSource),
    utmMedium: normalizeNullableString(body?.utmMedium),
    utmCampaign: normalizeNullableString(body?.utmCampaign),
    utmContent: normalizeNullableString(body?.utmContent),
    utmTerm: normalizeNullableString(body?.utmTerm),
    referrer: normalizeNullableString(body?.referrer),
    pagePath: normalizeNullableString(body?.pagePath),
    userAgent: normalizeNullableString(body?.userAgent),
    ip: normalizeNullableString(body?.ip),
    country: normalizeNullableString(body?.country),
  });

  return jsonNoStore(
    {
      id: lead.id,
      email: lead.email,
      userId: lead.userId ?? null,
      sources: lead.sources.map(mapSourceOutput),
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    },
    { status: 201 },
  );
}
