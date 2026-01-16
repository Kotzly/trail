import { sendMessage } from "./background.js";
import { msg } from "../../shared/types/messages.js";
import type { CommandState } from "../../shared/types/messages.js";

export async function getCommandState(): Promise<CommandState> {
    const res = await sendMessage(msg.getCommandState());
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function undo(): Promise<CommandState> {
    const res = await sendMessage(msg.undo());
    if (!res.success) {
        throw new Error(res.error);
    }
    return res.data;
}

export async function redo(): Promise<CommandState> {
    const res = await sendMessage(msg.redo());
    if (!res.success) throw new Error(res.error);
    return res.data;
}

