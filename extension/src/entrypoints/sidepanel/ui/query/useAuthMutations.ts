import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CheckoutInput } from "../../../../shared/types/account.js";
import type { CompleteOnboardingInput } from "../../api/account.js";
import {
  completeOnboarding,
  createBillingPortalLink,
  startCheckout,
} from "../../api/account.js";
import { accountKeys } from "./account-keys.js";

export function useAuthMutations() {
  const queryClient = useQueryClient();

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
    startCheckoutMutation,
    createBillingPortalLinkMutation,
    completeOnboardingMutation,
  };
}
