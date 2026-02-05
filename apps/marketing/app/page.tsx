import { Suspense } from "react";
import { HomeLoading } from "./components/page-wrapper";
import { HomeContent } from "./HomeSections";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
