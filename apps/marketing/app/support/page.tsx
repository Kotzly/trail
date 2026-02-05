"use client";

import { Suspense } from "react";
import { SupportLoading } from "../components/page-wrapper";
import { SupportContent } from "./SupportSections";

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportLoading />}>
      <SupportContent />
    </Suspense>
  );
}
