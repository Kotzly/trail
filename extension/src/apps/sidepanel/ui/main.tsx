import "@ui/panel/styles.css";
import "@shared/styles/fonts.js";
import { mountPanelApp } from "@ui/panel/bootstrap.js";
import { captureEvent, initObservability } from "@shared/lib/observability.js";

void initObservability("sidepanel").then(() => {
  captureEvent("sidepanel_opened");
});

mountPanelApp({ connectPortName: "sidepanel" });
