import { ALLOWED_SITE_MATCH_PATTERNS } from "../shared/config/site-origins";
import { mountContentUi } from "./content-ui/mount";

export default defineContentScript({
  matches: [...ALLOWED_SITE_MATCH_PATTERNS],
  runAt: "document_start",
  allFrames: false,
  async main(ctx) {
    void import("../content/bridge/runtime");
    await mountContentUi(ctx);
  },
});
