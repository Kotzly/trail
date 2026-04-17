import { createProxyService } from "@webext-core/proxy-service";
import {
  ACTION_SERVICE_KEY,
  COMMAND_SERVICE_KEY,
  FLAGS_SERVICE_KEY,
  SETTINGS_SERVICE_KEY,
  TABS_SERVICE_KEY,
  TREE_SERVICE_KEY,
  type ActionService,
  type CommandService,
  type FlagsService,
  type SettingsService,
  type TabsService,
  type TreeService,
} from "./proxy-services.js";

export const treeService = createProxyService<TreeService>(TREE_SERVICE_KEY);
export const commandService = createProxyService<CommandService>(COMMAND_SERVICE_KEY);
export const settingsService = createProxyService<SettingsService>(SETTINGS_SERVICE_KEY);
export const flagsService = createProxyService<FlagsService>(FLAGS_SERVICE_KEY);
export const tabsService = createProxyService<TabsService>(TABS_SERVICE_KEY);
export const actionService = createProxyService<ActionService>(ACTION_SERVICE_KEY);
