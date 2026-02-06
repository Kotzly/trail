import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";
import { getExtensionConfig } from "@/src/server/extension-config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  return jsonNoStore(getExtensionConfig());
}
