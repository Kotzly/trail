import { Suspense } from "react";
import { ContactLoading } from "../components/page-wrapper";
import { SanityPage } from "../components/SanityPage";
import { ContactContent } from "./ContactSections";

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactLoading />}>
      <SanityPage slug="contact" fallback={<ContactContent />} />
    </Suspense>
  );
}
