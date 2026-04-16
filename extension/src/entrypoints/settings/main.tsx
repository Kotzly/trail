import { createRoot } from "react-dom/client";
import "@ui/panel/styles.css";
import SettingsApp from "@apps/settings/SettingsApp.js";
import { captureEvent, initObservability } from "@shared/lib/observability.js";

void initObservability("settings").then(() => {
  captureEvent("settings_opened");
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<SettingsApp />);
}
