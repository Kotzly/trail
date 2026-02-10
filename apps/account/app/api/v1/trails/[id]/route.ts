import { proxyToApi } from "@/src/server/proxy";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi(request, `/api/v1/trails/${encodeURIComponent(id)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi(request, `/api/v1/trails/${encodeURIComponent(id)}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToApi(request, `/api/v1/trails/${encodeURIComponent(id)}`);
}
