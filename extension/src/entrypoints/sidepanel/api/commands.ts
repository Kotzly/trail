import { sendMessage } from "./background.js";
import { rpc } from "@shared/rpc/contracts.js";
import type { CommandState } from "@shared/rpc/contracts.js";

export async function getCommandState(): Promise<CommandState> {
    const res = await sendMessage(rpc.getCommandState());
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function undo(): Promise<CommandState> {
    const res = await sendMessage(rpc.undo());
    if (!res.success) {
        throw new Error(res.error);
    }
    return res.data;
}

export async function redo(): Promise<CommandState> {
    const res = await sendMessage(rpc.redo());
    if (!res.success) throw new Error(res.error);
    return res.data;
}

