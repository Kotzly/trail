"use client";

import { Suspense } from "react";
import { FAQLoading } from "../components/page-wrapper";
import { FAQContent } from "./FaqSections";

export default function FAQPage() {
  return (
    <Suspense fallback={<FAQLoading />}>
      <FAQContent />
    </Suspense>
  );
}
