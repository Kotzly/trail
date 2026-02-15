import {
  ALLOWED_SITE_MATCH_PATTERNS,
} from "../src/shared/config/site-origins";

export default defineContentScript({
  matches: [...ALLOWED_SITE_MATCH_PATTERNS],
  runAt: "document_start",
  allFrames: false,
  main() {
    void import("../src/content/content-script");
  },
});
