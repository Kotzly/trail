"use client";

import { Suspense } from "react";
import { PricingLoading } from "../components/page-wrapper";
import { PricingContent } from "./PricingSections";

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <PricingContent />
    </Suspense>
  );
}
