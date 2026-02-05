import { jsonNoStore } from "@/src/server/response";
import { listPlans } from "@/src/server/account-snapshot";

export const runtime = "nodejs";

export async function GET(_request: Request) {
  return jsonNoStore(listPlans());
}
