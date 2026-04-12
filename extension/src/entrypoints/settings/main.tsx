import { createRoot } from "react-dom/client";
import "@ui/panel/styles.css";
import SettingsApp from "@apps/settings/SettingsApp.js";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<SettingsApp />);
}
