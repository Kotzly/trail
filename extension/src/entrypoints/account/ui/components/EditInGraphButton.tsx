import { useCallback, useState } from "react";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc } from "@shared/rpc/contracts.js";

type EditInGraphButtonProps = {
  treeId: string;
};

type ButtonState = "idle" | "opening" | "editing";

export default function EditInGraphButton({ treeId }: EditInGraphButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");

  const handleClick = useCallback(async () => {
    if (state !== "idle") return;
    setState("opening");
    try {
      const response = await sendRpcMessage(rpc.openFullviewEditor({ treeId }));
      if (response.success) {
        setState("editing");
      } else {
        console.error("Failed to open editor:", response.error);
        setState("idle");
      }
    } catch (err) {
      console.error("Failed to open editor:", err);
      setState("idle");
    }
  }, [treeId, state]);

  return (
    <button
      type="button"
      className="account-btn account-btn--primary"
      onClick={() => void handleClick()}
      disabled={state !== "idle"}
    >
      {state === "opening" && (
        <svg
          className="account-spinner"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {state === "idle" && "Edit in graph"}
      {state === "opening" && "Opening..."}
      {state === "editing" && "Editing"}
    </button>
  );
}
