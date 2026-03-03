export const accountKeys = {
  root: ["account"] as const,
  snapshot: () => [...accountKeys.root, "snapshot"] as const,
  profile: () => [...accountKeys.root, "profile"] as const,
  subscription: () => [...accountKeys.root, "subscription"] as const,
  billing: () => [...accountKeys.root, "billing"] as const,
  plans: () => [...accountKeys.root, "plans"] as const,
};
