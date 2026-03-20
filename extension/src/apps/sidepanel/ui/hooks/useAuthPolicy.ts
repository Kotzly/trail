import { useEffect } from "react";
import { authPolicyItem, guestWelcomeDismissedItem } from "@shared/config/storage-items.js";
import { useStore } from "../state/store.js";

export function useAuthPolicy(): void {
  const setAccount = useStore((state) => state.setAccount);

  useEffect(() => {
    Promise.all([authPolicyItem.getValue(), guestWelcomeDismissedItem.getValue()]).then(
      ([policy, dismissed]) => {
        setAccount({
          authRequired: policy?.authRequired ?? false,
          guestWelcomeDismissed: dismissed,
          authPolicyLoaded: true,
        });
      },
    );

    const unwatchPolicy = authPolicyItem.watch((newVal) => {
      setAccount({
        authRequired: newVal?.authRequired ?? false,
      });
    });

    const unwatchDismissed = guestWelcomeDismissedItem.watch((newVal) => {
      setAccount({
        guestWelcomeDismissed: newVal,
      });
    });

    return () => {
      unwatchPolicy();
      unwatchDismissed();
    };
  }, [setAccount]);
}
