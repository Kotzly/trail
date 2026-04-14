import type { CommandState } from "@shared/rpc/contracts.js";
import { commandService } from "@shared/transport/proxy-clients.js";

export async function getCommandState(): Promise<CommandState> {
  return commandService.getCommandState();
}

export async function undo(): Promise<CommandState> {
  return commandService.undo();
}

export async function redo(): Promise<CommandState> {
  return commandService.redo();
}
