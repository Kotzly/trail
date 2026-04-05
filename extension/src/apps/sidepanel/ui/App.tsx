import { useEffect, useRef } from "react";
import FloatingControls from "./components/FloatingControls.js";
import EditorToolbar from "./components/EditorToolbar.js";
import GraphArea from "@features/graph/components/graph/GraphArea.js";
import ContextMenus from "./components/ContextMenus.js";
import DeleteTreeConfirmModal from "./components/DeleteTreeConfirmModal.js";
import SessionExpiredBanner from "./components/SessionExpiredBanner.js";
import TrailLogo from "@ui/components/trail-logo";
import { Toaster } from "./components/ui/sonner.js";
import { useBootstrap } from "./hooks/useBootstrap.js";
import { useAccount } from "./hooks/useAccount.js";
import { useAuthPolicy } from "./hooks/useAuthPolicy.js";
import { useRuntimeMessages } from "./hooks/useRuntimeMessages.js";
import { useShortcuts } from "./hooks/useShortcuts.js";
import TooltipLayer from "./components/TooltipLayer.js";

import { useSystemThemeListener } from "./hooks/useSystemThemeListener.js";
import { useStore } from "./state/store.js";
import { sessionBannerDismissedItem } from "@shared/config/storage-items.js";
import OnboardingHints from "./components/OnboardingHints.js";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Button } from "@ui/components/ui/button";
import { cn } from "@ui/lib/utils";

function BootstrapSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-2.5">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="flex-1 min-h-[200px] rounded-lg" />
    </div>
  );
}

function DegradedBootstrap({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
      <TrailLogo label="Trail" />
      <h2 className="text-lg font-semibold">Could not load Trail</h2>
      <p className="text-[13px] text-muted-foreground max-w-[280px]">
        Something prevented Trail from starting. This is usually temporary.
      </p>
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        Retry
      </Button>
      <a
        href="https://gettrail.net/support"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground underline"
      >
        Report issue
      </a>
    </div>
  );
}

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const account = useStore((state) => state.account);
  const editorActive = useStore((state) => state.editorMode.active);

  const { bootstrapStatus, retryBootstrap } = useBootstrap();
  useAccount();
  useAuthPolicy();
  useRuntimeMessages();
  useSystemThemeListener();
  useShortcuts(searchInputRef);

  // Clear session banner dismiss when auth is restored so banner reappears on next expiry
  useEffect(() => {
    if (!account.sessionExpired) {
      sessionBannerDismissedItem.setValue(false).catch(() => {});
    }
  }, [account.sessionExpired]);

  if (bootstrapStatus === "loading") {
    return (
      <div className="flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative">
        <Toaster />
        <BootstrapSkeleton />
      </div>
    );
  }

  if (bootstrapStatus === "degraded") {
    return (
      <div className="flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative">
        <Toaster />
        <DegradedBootstrap onRetry={retryBootstrap} />
      </div>
    );
  }

  const isAuthenticated = account.session.status === "authenticated" && Boolean(account.user);

  const showSessionBanner = !isAuthenticated && !account.authRequired && account.sessionExpired;

  return (
    <div className={cn("flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative", editorActive && "ring-3 ring-inset ring-blue-500/45 rounded-xl")}>
      <Toaster />
      {showSessionBanner && <SessionExpiredBanner />}
      <EditorToolbar />
      <FloatingControls searchInputRef={searchInputRef} />
      <OnboardingHints />
      <GraphArea />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
