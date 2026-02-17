import { Suspense } from "react";
import { PricingLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { PricingContent } from "./PricingSections";

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <SanityPage slug="pricing" fallback={<PricingContent />} />
    </Suspense>
  );
}
