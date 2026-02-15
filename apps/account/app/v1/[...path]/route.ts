import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Temporary redirect shim: /v1/* → /api/v1/*
 *
 * Old extension versions still call /v1/*. This catch-all issues a 308
 * (Permanent Redirect, preserving method) so they hit the new prefix.
 * Remove once all clients are updated.
 */
function redirect(request: Request, path: string[]) {
  const url = new URL(request.url);
  url.pathname = `/api/v1/${path.join("/")}`;
  return NextResponse.redirect(url, 308);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return redirect(request, (await params).path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return redirect(request, (await params).path);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return redirect(request, (await params).path);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return redirect(request, (await params).path);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return redirect(request, (await params).path);
}
