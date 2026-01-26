import { NextResponse } from "next/server";
import { listPlans } from "@/src/server/account-snapshot";

export async function GET() {
  return NextResponse.json(listPlans());
}
