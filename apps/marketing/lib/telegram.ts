import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

function botUrl(token: string, method: string) {
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

type TelegramResponse<T> = { ok: true; result: T } | { ok: false; description: string };

async function call<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(botUrl(token, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as TelegramResponse<T>;

  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description}`);
  }

  return data.result;
}

export async function sendMessage(
  token: string,
  chatId: string,
  threadId: number,
  text: string,
) {
  return call<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    message_thread_id: threadId,
    text,
    parse_mode: "HTML",
  });
}

export async function createForumTopic(
  token: string,
  chatId: string,
  name: string,
  iconColor?: number,
) {
  return call<{ message_thread_id: number; name: string }>(
    token,
    "createForumTopic",
    {
      chat_id: chatId,
      name,
      ...(iconColor != null && { icon_color: iconColor }),
    },
  );
}
