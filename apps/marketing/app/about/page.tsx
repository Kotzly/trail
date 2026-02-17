import { Suspense } from "react";
import { AboutLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { AboutContent } from "./AboutSections";

export default function AboutPage() {
  return (
    <Suspense fallback={<AboutLoading />}>
      <SanityPage slug="about" fallback={<AboutContent />} />
    </Suspense>
  );
}
