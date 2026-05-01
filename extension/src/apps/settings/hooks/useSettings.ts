import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@shared/types/settings.js";
import { getSettings, saveSettings } from "../api.js";

const SETTINGS_KEY = ["settings"] as const;

export function useSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: getSettings });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_KEY });
      const previous = queryClient.getQueryData<Settings>(SETTINGS_KEY);
      queryClient.setQueryData(SETTINGS_KEY, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(SETTINGS_KEY, ctx.previous);
    },
  });

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const current = queryClient.getQueryData<Settings>(SETTINGS_KEY);
      if (!current) return;
      mutation.mutate({ ...current, ...patch } as Settings);
    },
    [mutation, queryClient],
  );

  return {
    settings: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    updateSettings,
  };
}
