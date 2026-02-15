import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import {
  getUserById,
  markUserOnboardingSeen,
} from "@/src/server/backend/user";
import { buildOnboardingState } from "@/src/server/onboarding";

export const runtime = "nodejs";

type OnboardingAction = "complete" | "skip";

type OnboardingBody = {
  action?: unknown;
};

function isValidAction(value: unknown): value is OnboardingAction {
  return value === "complete" || value === "skip";
}

async function authenticateRequest(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) return null;
  const payload = await verifyExtensionToken(token);
  return payload?.sub ? { userId: payload.sub } : null;
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(auth.userId);
  if (!user) {
    return jsonError("user_not_found", "User not found.", { status: 404 });
  }

  return jsonNoStore({
    onboarding: buildOnboardingState(user.onboardingSeenAt),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body: OnboardingBody = await request.json().catch(() => ({}));

  if (!isValidAction(body.action)) {
    return jsonError("invalid_action", "Invalid action. Must be 'complete' or 'skip'.", { status: 400 });
  }

  const seenAt = await markUserOnboardingSeen(auth.userId);
  if (seenAt === null) {
    return jsonError("user_not_found", "User not found.", { status: 404 });
  }

  return jsonNoStore({ onboarding: buildOnboardingState(seenAt) });
}
