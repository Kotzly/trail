"use client";

import { Suspense } from "react";
import { ContactLoading } from "../components/page-wrapper";
import { ContactContent } from "./ContactSections";

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactLoading />}>
      <ContactContent />
    </Suspense>
  );
}
