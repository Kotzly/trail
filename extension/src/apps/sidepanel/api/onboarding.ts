import { onboardingStateItem, type OnboardingState } from "@shared/config/storage-items.js";
import { captureEvent } from "@shared/lib/observability.js";
import { importTrail } from "./tree.js";
import { buildJapanDemoBundle } from "../ui/onboarding/japan-demo-tree.js";

export async function getOnboardingState(): Promise<OnboardingState> {
  return onboardingStateItem.getValue();
}

export async function saveOnboardingState(patch: Partial<OnboardingState>): Promise<void> {
  const current = await onboardingStateItem.getValue();
  await onboardingStateItem.setValue({ ...current, ...patch });
}

export async function startOnboarding(): Promise<void> {
  await saveOnboardingState({ seenWelcome: true, step: 0 });
  captureEvent("onboarding_started");
}

export async function advanceOnboarding(step: number): Promise<void> {
  await saveOnboardingState({ step });
  captureEvent("onboarding_step_viewed", { step });
}

export async function completeOnboarding(): Promise<void> {
  await saveOnboardingState({ seenWelcome: true, completedAt: Date.now() });
  captureEvent("onboarding_completed");
}

export async function skipOnboarding(): Promise<void> {
  // Skipping still marks the wizard as "seen" so it doesn't re-open
  // automatically. Users can re-launch from Settings → About.
  await saveOnboardingState({ seenWelcome: true });
  captureEvent("onboarding_skipped");
}

export async function loadDemoTree(): Promise<{ treeId: string }> {
  const bundle = buildJapanDemoBundle();
  const result = await importTrail(bundle);
  captureEvent("tree_imported", { source: "onboarding_demo" });
  return result;
}
