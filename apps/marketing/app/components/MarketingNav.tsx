"use client";

import { MarketingNav as SharedMarketingNav } from "@trail/ui/marketing";
import { publicEnv } from "@/lib/public-env";

export function MarketingNav() {
  return <SharedMarketingNav appBaseUrl={publicEnv.NEXT_PUBLIC_APP_URL} />;
}
