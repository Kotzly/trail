import { ALLOWED_SITE_MATCH_PATTERNS } from "../shared/config/site-origins";

export default defineContentScript({
  matches: [...ALLOWED_SITE_MATCH_PATTERNS],
  runAt: "document_start",
  allFrames: false,
  async main(_ctx) {
    void import("../content/bridge/runtime");
  },
});
