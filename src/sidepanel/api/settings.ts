import { msg } from "../../shared/types/messages.js";
import { Settings } from "../../shared/types/settings.js";
import { sendMessage } from "./background.js";

export async function saveSettings(settings: Settings): Promise<void> {
    const response = await sendMessage(msg.saveSettings({ settings }));
    if (!response.success) throw new Error(response.error);
    return response.data;
}

export async function getSettings(): Promise<Settings> {
    const response = await sendMessage(msg.getSettings());
    if (!response.success) throw new Error(response.error);
    return response.data;
}