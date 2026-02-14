"use client";

import { useEffect, useRef } from "react";
import { onExtensionEvent } from "@/src/lib/trail-extension";

export default function AuthSyncListener() {
  const revokingRef = useRef(false);

  useEffect(() => {
    return onExtensionEvent((event) => {
      if (event.type !== "AUTH_REVOKED") {
        return;
      }

      if (revokingRef.current) {
        return;
      }
      revokingRef.current = true;

      fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
        .catch(() => undefined)
        .finally(() => {
          window.location.assign("/");
        });
    });
  }, []);

  return null;
}
