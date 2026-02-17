import { Suspense } from "react";
import { DownloadsLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { DownloadsContent } from "./DownloadsSections";

export default function DownloadsPage() {
  return (
    <Suspense fallback={<DownloadsLoading />}>
      <SanityPage slug="downloads" fallback={<DownloadsContent />} />
    </Suspense>
  );
}
