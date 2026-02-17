import { Suspense } from "react";
import { FAQLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { FAQContent } from "./FaqSections";

export default function FAQPage() {
  return (
    <Suspense fallback={<FAQLoading />}>
      <SanityPage slug="faq" fallback={<FAQContent />} />
    </Suspense>
  );
}
