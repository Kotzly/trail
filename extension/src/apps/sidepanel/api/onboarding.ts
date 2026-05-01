import {
  onboardingStateItem,
  type OnboardingPersona,
  type OnboardingPhase,
  type OnboardingSoftCtaKey,
  type OnboardingState,
} from "@shared/config/storage-items.js";
import { captureEvent } from "@shared/lib/observability.js";
import { createNewTree, deleteTree, importTrail, openTree } from "./tree.js";
import { buildJapanDemoBundle } from "../ui/onboarding/japan-demo-tree.js";

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
    tourStep: 0,
    persona: null,
    tourTreeId: null,
    startedAt: Date.now(),
  });
  captureEvent("onboarding_started");
}

export async function advanceOnboarding(step: number): Promise<void> {
  await saveOnboardingState({ step });
  captureEvent("onboarding_step_viewed", { step });
}

export async function setWizardStep(wizardStep: number): Promise<void> {
  await saveOnboardingState({ wizardStep });
  captureEvent("onboarding_step_viewed", { step: wizardStep, surface: "wizard" });
}

export async function setTourStep(tourStep: number): Promise<void> {
  await saveOnboardingState({ tourStep });
  captureEvent("onboarding_step_viewed", { step: tourStep, surface: "tour" });
}

export async function setOnboardingPhase(phase: OnboardingPhase | null): Promise<void> {
  await saveOnboardingState({ phase });
  if (phase) captureEvent("onboarding_phase_entered", { phase });
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
  // Skipping still marks the wizard as "seen" so it doesn't re-open
  // automatically. Users can re-launch from Settings → About.
  await saveOnboardingState({ seenWelcome: true, phase: "done" });
  captureEvent("onboarding_skipped");
}

/**
 * Create a dedicated "Trail tour" tree that becomes the active tree.
 * Used by the interactive tour so the user's real browsing isn't
 * polluted with tour artefacts. Stores its id so we can delete it on
 * completion.
 */
export async function startTourTree(label = "Trail tour"): Promise<void> {
  await createNewTree(label);
  // createNewTree doesn't return the new tree id. The background
  // broadcasts a TreeUpdated event on creation; the sidepanel's
  // store picks up `trees.active.id` shortly after. We persist the id
  // in storage via a follow-up call once the store settles (handled
  // by the caller that has the fresh id).
  captureEvent("onboarding_tour_tree_created");
}

export async function bindTourTreeId(tourTreeId: string): Promise<void> {
  await saveOnboardingState({ tourTreeId });
}

/**
 * Capture the pre-tour active tree id so `disposeTourTree` can
 * restore it before deletion (the background refuses to delete the
 * active tree).
 */
export async function savePriorActiveTreeId(priorActiveTreeId: string | null): Promise<void> {
  await saveOnboardingState({ priorActiveTreeId });
}

/**
 * Persist the tour anchors (first result child id, branch parent id)
 * so a sidepanel close mid-tour doesn't lose them. Observer rehydrates
 * these into refs on next mount.
 */
export async function saveTourAnchors(anchors: {
  tourFirstResultChildId?: string | null;
  tourBranchParentId?: string | null;
}): Promise<void> {
  await saveOnboardingState(anchors);
}

/**
 * Switch the active tree away from the tour tree back to whatever was
 * active before the tour started (or a fresh blank tree if nothing
 * was). Leaves the tour tree itself intact — used by both
 * `disposeTourTree` (which deletes after) and `dismissTour` (which
 * keeps it for Resume).
 */
async function switchAwayFromTourTree(
  tourTreeId: string,
  priorActiveTreeId: string | null,
): Promise<void> {
  try {
    if (priorActiveTreeId && priorActiveTreeId !== tourTreeId) {
      await openTree(priorActiveTreeId);
    } else {
      // Fresh-install users had no pre-existing tree.
      await createNewTree("My trail");
    }
  } catch (err) {
    console.warn("[onboarding] failed to switch away from tour tree", err);
    // Continue — callers handle the fallout.
  }
}

/**
 * Delete the tour tree (if any) and clear its id from state. Safe to
 * call even when there's no tour tree — it no-ops.
 *
 * The background refuses to delete the active tree, so we first
 * switch to whatever was active before the tour started. Fresh-
 * install users with no prior tree get a new empty tree instead,
 * which doubles as a nice "here's your first real tree" landing.
 */
export async function disposeTourTree(): Promise<void> {
  const current = await onboardingStateItem.getValue();
  const treeId = current.tourTreeId ?? null;
  if (!treeId) return;

  await switchAwayFromTourTree(treeId, current.priorActiveTreeId ?? null);

  try {
    await deleteTree(treeId);
  } catch (err) {
    // Tour-tree cleanup should never block CTA completion. Log and
    // move on — worst case the user sees "Trail tour" in their list.
    console.warn("[onboarding] failed to delete tour tree", err);
  }
  await saveOnboardingState({
    tourTreeId: null,
    priorActiveTreeId: null,
    tourFirstResultChildId: null,
    tourBranchParentId: null,
  });
}

/**
 * Dismiss the tour without deleting it. Switches back to the prior
 * active tree so the user isn't stranded on the tour tree, but keeps
 * `tourTreeId` + step + anchors so they can Resume later from the
 * hint strip. `completedAt` is NOT set — dismiss is explicitly NOT
 * completion.
 *
 * Sequence is strict: switch active tree FIRST, then flip phase,
 * then clear spotlight. Phase-flip last so observers that key on
 * `phase === "tour"` don't race with a stale active tree.
 */
export async function dismissTour(): Promise<void> {
  const current = await onboardingStateItem.getValue();
  // Defensive: a corrupted state where `completedAt` is set AND the
  // user somehow hits dismiss should not resurrect `tourDismissed`.
  // Let `skipOnboarding` semantics apply instead.
  if (current.completedAt) {
    await saveOnboardingState({ phase: "done" });
    return;
  }
  const treeId = current.tourTreeId ?? null;
  if (treeId) {
    await switchAwayFromTourTree(treeId, current.priorActiveTreeId ?? null);
  }
  await saveOnboardingState({ phase: "tourDismissed" });
  captureEvent("onboarding_tour_dismissed", {
    tourStep: current.tourStep ?? 0,
  });
}

/**
 * Resume a dismissed tour. Re-activates the preserved tour tree and
 * flips phase back to "tour" — observer picks up from stored step
 * and anchors. Returns `"orphan"` when the tour tree no longer
 * exists (e.g., user manually deleted it from the tree list), so
 * callers can recover gracefully.
 */
export async function resumeTour(params: { treeExists: boolean }): Promise<"ok" | "orphan"> {
  const current = await onboardingStateItem.getValue();
  const treeId = current.tourTreeId ?? null;
  if (!treeId || !params.treeExists) {
    // Tour tree was deleted out from under us. Clean up and bail so
    // the user lands somewhere sane — the strip will disappear
    // because `phase !== "tourDismissed"` and no `completedAt`.
    captureEvent("onboarding_tour_resume_orphan");
    await saveOnboardingState({
      phase: "done",
      tourTreeId: null,
      tourStep: 0,
      tourFirstResultChildId: null,
      tourBranchParentId: null,
      priorActiveTreeId: null,
    });
    return "orphan";
  }
  try {
    await openTree(treeId);
  } catch (err) {
    // Caller's `treeExists` was stale — tree actually gone at
    // background level. Treat as orphan so the user isn't stranded
    // on a phantom tour tree.
    console.warn("[onboarding] openTree failed on resume; treating as orphan", err);
    captureEvent("onboarding_tour_resume_orphan");
    await saveOnboardingState({
      phase: "done",
      tourTreeId: null,
      tourStep: 0,
      tourFirstResultChildId: null,
      tourBranchParentId: null,
      priorActiveTreeId: null,
    });
    return "orphan";
  }
  await saveOnboardingState({ phase: "tour" });
  captureEvent("onboarding_tour_resumed", {
    tourStep: current.tourStep ?? 0,
  });
  return "ok";
}

/**
 * Persist a user × on one of the post-onboarding soft CTAs. Only
 * explicit dismiss writes `true` — auth-driven auto-hide is
 * predicate-level so the strip returns on sign-out.
 */
export async function dismissSoftCta(surface: OnboardingSoftCtaKey): Promise<void> {
  const current = await onboardingStateItem.getValue();
  const next = { ...(current.softCtaDismissed ?? {}), [surface]: true };
  await saveOnboardingState({ softCtaDismissed: next });
  captureEvent("onboarding_soft_cta_dismissed", { surface });
}

export async function loadDemoTree(): Promise<{ treeId: string }> {
  const bundle = buildJapanDemoBundle();
  const result = await importTrail(bundle);
  captureEvent("tree_imported", { source: "onboarding_demo" });
  return result;
}
