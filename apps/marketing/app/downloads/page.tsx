"use client";

import { Suspense } from "react";
import { DownloadsLoading } from "../components/page-wrapper";
import { DownloadsContent } from "./DownloadsSections";

export default function DownloadsPage() {
  return (
    <Suspense fallback={<DownloadsLoading />}>
      <DownloadsContent />
    </Suspense>
  );
}
