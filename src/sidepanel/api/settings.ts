import { msg } from "../../shared/types/messages";
import { Settings } from "../../shared/types/settings";
import { sendMessage } from "./background";

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