-- Add preferred_locale to account_settings so user language preference
-- persists on the server and can follow the user across the web app and
-- the browser extension.
--
-- Default 'en' matches the apps' current fallback locale. Length cap of
-- 10 chars covers BCP-47 tags like `en`, `en-US`, `zh-Hans-CN`.

ALTER TABLE account_settings
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE account_settings
  ADD CONSTRAINT account_settings_preferred_locale_len
  CHECK (char_length(preferred_locale) BETWEEN 2 AND 10);
