import { Metadata } from "next";
import { Suspense } from "react";
import { SanityPage } from "../components/SanityPage";
import { FeaturesContent } from "./FeaturesSections";

export const metadata: Metadata = {
  title: "Features · Trail",
  description:
    "Everything you need for better research. One-click capture, instant search, visual pathways, and more.",
};

export default function FeaturesPage() {
  return (
    <Suspense>
      <SanityPage slug="features" fallback={<FeaturesContent />} />
    </Suspense>
  );
}
