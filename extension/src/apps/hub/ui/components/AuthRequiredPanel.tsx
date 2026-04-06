import { useCallback, useState } from "react";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc } from "@shared/rpc/contracts.js";
import { Button } from "@ui/components/ui/button";

export default function AuthRequiredPanel() {
  const [busy, setBusy] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sendRpcMessage(rpc.oauthInteractiveLogin());
    } catch (err) {
      console.error("Sign-in failed:", err);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="flex flex-col items-center gap-3 py-12 px-6 border border-dashed rounded-lg text-center">
      <div className="text-muted-foreground">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="text-[15px] font-medium text-foreground m-0">Sign in to access</h2>
      <p className="text-[13px] text-muted-foreground max-w-[280px] m-0">
        This feature requires an account. Sign in to get started.
      </p>
      <Button
        onClick={() => void handleSignIn()}
        disabled={busy}
      >
        {busy ? "Signing in..." : "Sign in"}
      </Button>
    </div>
  );
}
