"use client";

import { WelcomeModal, useWelcomeModal } from "@/app/components/onboarding/WelcomeModal";

export function WelcomeModalWrapper() {
  const { isOpen, close, markAsShown } = useWelcomeModal();

  return (
    <WelcomeModal
      isOpen={isOpen}
      onClose={() => {
        markAsShown();
        close();
      }}
      onSkip={() => {
        markAsShown();
      }}
      onComplete={() => {
        markAsShown();
      }}
    />
  );
}
