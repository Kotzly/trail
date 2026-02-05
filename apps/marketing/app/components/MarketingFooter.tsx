import { MarketingFooter as SharedMarketingFooter } from "@trail/ui/marketing";
import { publicEnv } from "@/lib/public-env";

export function MarketingFooter() {
  return <SharedMarketingFooter appBaseUrl={publicEnv.NEXT_PUBLIC_APP_URL} />;
}
