import { ThemeId } from "../../sidepanel/ui/shared/themes.js";

export type Settings = {
    maxOpenTabs: number;
    capacity: number;
    theme: ThemeId;
}