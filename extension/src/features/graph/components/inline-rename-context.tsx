import { createContext, useContext, type ReactNode } from "react";
import type { NodeId } from "@shared/types/ids.js";

type InlineRenameContextValue = {
  targetId: NodeId | null;
  onCommit: (nodeId: NodeId, title: string) => void;
  onCancel: () => void;
};

const InlineRenameContext = createContext<InlineRenameContextValue | null>(null);

export function InlineRenameProvider({
  value,
  children,
}: {
  value: InlineRenameContextValue;
  children: ReactNode;
}) {
  return <InlineRenameContext.Provider value={value}>{children}</InlineRenameContext.Provider>;
}

export function useInlineRename(): InlineRenameContextValue {
  const ctx = useContext(InlineRenameContext);
  if (!ctx) {
    return {
      targetId: null,
      onCommit: () => {},
      onCancel: () => {},
    };
  }
  return ctx;
}
