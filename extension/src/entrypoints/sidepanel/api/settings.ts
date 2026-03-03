import { rpc } from "../../../shared/rpc/contracts.js";
import { Settings } from "../../../shared/types/settings.js";
import { sendMessage } from "./background.js";

export async function saveSettings(settings: Settings): Promise<void> {
    const response = await sendMessage(rpc.saveSettings({ settings }));
    if (!response.success) throw new Error(response.error);
    return response.data;
}

export async function getSettings(): Promise<Settings> {
    const response = await sendMessage(rpc.getSettings());
    if (!response.success) throw new Error(response.error);
    return response.data;
}