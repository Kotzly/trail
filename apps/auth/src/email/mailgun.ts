import type { EmailMessage, EmailProvider } from "./provider";
import { env } from "../env";

const MAILGUN_API_BASE_URL = "https://api.mailgun.net/v3";

const buildAuthorizationHeader = (apiKey: string): string => {
  const token = Buffer.from(`api:${apiKey}`).toString("base64");
  return `Basic ${token}`;
};

export const mailgunProvider = (): EmailProvider => {
  const apiKey = env.MAILGUN_API_KEY;
  const domain = env.MAILGUN_DOMAIN;
  const fromEmail = env.MAILGUN_FROM_EMAIL;

  return {
    async send(message: EmailMessage) {
      const body = new URLSearchParams({
        from: fromEmail,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });

      const response = await fetch(
        `${MAILGUN_API_BASE_URL}/${domain}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: buildAuthorizationHeader(apiKey),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const messageSuffix = errorText ? `: ${errorText}` : "";
        throw new Error(
          `Mailgun request failed (${response.status})${messageSuffix}`,
        );
      }
    },
  };
};
