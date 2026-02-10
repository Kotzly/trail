import { proxyToApi } from "@/src/server/proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qs = url.search;
  return proxyToApi(request, `/api/v1/trails${qs}`);
}
