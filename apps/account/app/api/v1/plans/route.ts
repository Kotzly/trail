import { jsonNoStore } from "@/src/server/backend/response";
import { listPlans } from "@/src/server/backend/account-snapshot";

export const runtime = "nodejs";

export async function GET(_request: Request) {
  return jsonNoStore(listPlans());
}
