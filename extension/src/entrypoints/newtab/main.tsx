import "@shared/styles/inter.css";
import "@entrypoints/sidepanel/ui/styles/tokens.css";
import "@entrypoints/spotlight.content/style.css";
import "./ui/newtab.css";
import "./ui/bookmarks.css";

import { createRoot } from "react-dom/client";
import { initBackendConfig } from "@shared/config/backend.js";
import { NewTabApp } from "./ui/NewTabApp.js";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

void initBackendConfig();
createRoot(rootEl).render(<NewTabApp />);

// Clean up ghost autofocus input after React mounts and real input receives focus
setTimeout(() => document.querySelector("body > input[autofocus]")?.remove(), 500);
