import { Suspense } from "react";
import { SupportLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { SupportContent } from "./SupportSections";

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportLoading />}>
      <SanityPage slug="support" fallback={<SupportContent />} />
    </Suspense>
  );
}
