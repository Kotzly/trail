import { sendMessage } from "./background";
import { MSG, msg, ResponseMessage } from "../../shared/types/messages";
import type { CommandState } from "../../shared/types/messages";

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

