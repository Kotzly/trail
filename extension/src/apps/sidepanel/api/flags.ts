import type { FlagKey, ResolvedFlags } from "@shared/types/flags.js";
import { flagsService } from "@shared/transport/proxy-clients.js";

export async function getFlags(): Promise<ResolvedFlags> {
  return flagsService.getFlags();
}

export async function setFlag(key: FlagKey, value: unknown): Promise<ResolvedFlags> {
  return flagsService.setFlag({ key, value });
}

export async function resetFlags(): Promise<ResolvedFlags> {
  return flagsService.resetFlags();
}
