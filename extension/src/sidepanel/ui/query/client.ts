import { QueryClient } from "@tanstack/react-query";
import { normalizeAccountError } from "../../api/account.js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry(failureCount: number, error: unknown) {
        const normalized = normalizeAccountError(error);
        return Boolean(normalized.retryable) && failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
