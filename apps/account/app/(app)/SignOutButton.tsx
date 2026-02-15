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

    // Fire-and-forget: notify extension without blocking logout.
    // The server-side logout already revokes extension sessions.
    notifyAuthRevoked().catch(() => {});

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
