"use client";

import { Suspense } from "react";
import { AboutLoading } from "../components/page-wrapper";
import { AboutContent } from "./AboutSections";

export default function AboutPage() {
  return (
    <Suspense fallback={<AboutLoading />}>
      <AboutContent />
    </Suspense>
  );
}
