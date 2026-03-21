import { useEffect, useRef } from "react";
import FloatingControls from "./components/FloatingControls.js";
import GraphArea from "@features/graph/components/graph/GraphArea.js";
import ThemePanel from "./components/theme/ThemePanel.js";
import ContextMenus from "./components/ContextMenus.js";
import DeleteTreeConfirmModal from "./components/DeleteTreeConfirmModal.js";
import SessionExpiredBanner from "./components/SessionExpiredBanner.js";
import TrailLogo from "./components/TrailLogo.js";
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

function BootstrapSkeleton() {
  return (
    <div className="skeleton-bootstrap">
      <div className="skeleton-block skeleton-bootstrap__header" />
      <div className="skeleton-block skeleton-bootstrap__graph" />
    </div>
  );
}

function DegradedBootstrap({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="degraded-bootstrap"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 24,
        textAlign: "center",
        gap: 12,
      }}
    >
      <TrailLogo className="degraded-bootstrap__logo" label="Trail" />
      <h2
        className="degraded-bootstrap__title"
        style={{ margin: 0, fontSize: 18, fontWeight: 600 }}
      >
        Could not load Trail
      </h2>
      <p
        className="degraded-bootstrap__text"
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--text-secondary, #888)",
          maxWidth: 280,
        }}
      >
        Something prevented Trail from starting. This is usually temporary.
      </p>
      <button
        className="degraded-bootstrap__btn"
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 8,
          padding: "8px 20px",
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 6,
          border: "1px solid var(--border-primary, #333)",
          background: "var(--bg-interactive, #2a2a2a)",
          color: "var(--text-primary, #eee)",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
      <a
        className="degraded-bootstrap__link"
        href="https://gettrail.net/support"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 12,
          color: "var(--text-secondary, #888)",
          textDecoration: "underline",
        }}
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
      <div className="container">
        <Toaster />
        <BootstrapSkeleton />
      </div>
    );
  }

  if (bootstrapStatus === "degraded") {
    return (
      <div className="container">
        <Toaster />
        <DegradedBootstrap onRetry={retryBootstrap} />
      </div>
    );
  }

  const isAuthenticated = account.session.status === "authenticated" && Boolean(account.user);

  const showSessionBanner = !isAuthenticated && !account.authRequired && account.sessionExpired;

  const containerClass = `container${editorActive ? " container--editor" : ""}`;

  return (
    <div className={containerClass}>
      <Toaster />
      {showSessionBanner && <SessionExpiredBanner />}
      <FloatingControls searchInputRef={searchInputRef} />
      <OnboardingHints />
      <GraphArea />
      <ThemePanel />
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
