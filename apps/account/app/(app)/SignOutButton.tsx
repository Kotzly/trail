"use client";

import { useState } from "react";
import { notifyAuthRevoked } from "@/src/lib/trail-extension";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  variant?: "default" | "outline";
};

export default function SignOutButton({ variant = "outline" }: SignOutButtonProps) {
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await notifyAuthRevoked();
    } catch {
      // Ignore bridge errors and continue logout.
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } finally {
      window.location.assign("/");
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={() => void handleSignOut()}
      disabled={pending}
    >
      {pending ? "signing out..." : "sign out"}
    </Button>
  );
}
