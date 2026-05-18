import {
  onboardingStateItem,
  type OnboardingPersona,
  type OnboardingState,
} from "@shared/config/storage-items.js";
import { captureEvent } from "@shared/lib/observability.js";

export async function getOnboardingState(): Promise<OnboardingState> {
  return onboardingStateItem.getValue();
}

export async function saveOnboardingState(patch: Partial<OnboardingState>): Promise<void> {
  const current = await onboardingStateItem.getValue();
  await onboardingStateItem.setValue({ ...current, ...patch });
}

export async function startOnboarding(): Promise<void> {
  await saveOnboardingState({
    seenWelcome: true,
    step: 0,
    phase: "wizard",
    wizardStep: 0,
    persona: null,
    startedAt: Date.now(),
  });
  captureEvent("onboarding_started");
}

export async function setWizardStep(wizardStep: number): Promise<void> {
  await saveOnboardingState({ wizardStep });
  captureEvent("onboarding_step_viewed", { step: wizardStep, surface: "wizard" });
}

export async function setOnboardingPersona(persona: OnboardingPersona): Promise<void> {
  await saveOnboardingState({ persona });
  captureEvent("onboarding_persona_picked", { persona });
}

export async function completeOnboarding(): Promise<void> {
  await saveOnboardingState({
    seenWelcome: true,
    completedAt: Date.now(),
    phase: "done",
  });
  captureEvent("onboarding_completed");
}

export async function skipOnboarding(): Promise<void> {
  // Skip is terminal — onboarding never reopens unless the user
  // explicitly replays it from Settings → About.
  await saveOnboardingState({ seenWelcome: true, phase: "done" });
  captureEvent("onboarding_skipped");
}
