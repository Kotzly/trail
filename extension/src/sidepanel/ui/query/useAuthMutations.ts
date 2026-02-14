import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AuthPortalRequest,
  AuthPortalStatus,
  CheckoutInput,
} from "../../../shared/types/account.js";
import type { CompleteOnboardingInput } from "../../api/account.js";
import {
  checkAuthPortal,
  completeOnboarding,
  createBillingPortalLink,
  logout,
  startAuthPortal,
  startCheckout,
} from "../../api/account.js";
import { accountKeys } from "./account-keys.js";

export function useAuthMutations() {
  const queryClient = useQueryClient();

  const startAuthPortalMutation = useMutation({
    mutationFn: (input?: AuthPortalRequest) => startAuthPortal(input),
  });

  const checkAuthPortalMutation = useMutation({
    mutationFn: (sessionId: string) => checkAuthPortal(sessionId),
    onSuccess: (status: AuthPortalStatus) => {
      if (status.snapshot) {
        queryClient.setQueryData(accountKeys.snapshot(), status.snapshot);
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: accountKeys.root });
    },
  });

  const startCheckoutMutation = useMutation({
    mutationFn: (input: CheckoutInput) => startCheckout(input),
  });

  const createBillingPortalLinkMutation = useMutation({
    mutationFn: () => createBillingPortalLink(),
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: (input: CompleteOnboardingInput) => completeOnboarding(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
    },
  });

  return {
    startAuthPortalMutation,
    checkAuthPortalMutation,
    logoutMutation,
    startCheckoutMutation,
    createBillingPortalLinkMutation,
    completeOnboardingMutation,
  };
}
