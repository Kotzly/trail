import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import {
  getUserById,
  markUserOnboardingSeen,
} from "@/src/server/backend/user";
import { buildOnboardingState } from "@/src/server/onboarding";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";
import { onboardingBodySchema } from "@/src/server/api/schemas";
import { parseBody } from "@/src/server/api/validate";
import { db } from "@trail/db";

export const runtime = "nodejs";

async function authenticateRequest(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) return null;
  const payload = await verifyExtensionToken(token);
  return payload?.sub ? { userId: payload.sub } : null;
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(auth.userId, db);
  if (!user) {
    return jsonFail("user_not_found", "User not found.", { status: 404 });
  }

  return jsonOk({
    onboarding: buildOnboardingState(user.onboardingSeenAt),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = parseBody(onboardingBodySchema, rawBody);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400 });
  }

  const seenAt = await markUserOnboardingSeen(auth.userId, db);
  if (seenAt === null) {
    return jsonFail("user_not_found", "User not found.", { status: 404 });
  }

  return jsonOk({ onboarding: buildOnboardingState(seenAt) });
}
