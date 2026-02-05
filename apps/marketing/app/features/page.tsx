import { Metadata } from "next";
import { FeaturesContent } from "./FeaturesSections";

export const metadata: Metadata = {
  title: "Features · Trail",
  description:
    "Everything you need for better research. One-click capture, instant search, visual pathways, and more.",
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
