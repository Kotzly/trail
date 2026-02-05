import type { User } from "@trail/trpc";
import { devUser, getAuthBypassState } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

// Эта функция (ensureUser) не используется, если:
// - Не требуется удостоверяться в наличии пользователя в системе (например, когда операции не подразумевают работу с пользователем);
// - Для выполнения задачи не нужны данные пользователя или они уже гарантированно валидны;
// - Выборка или создание пользователя производится другими средствами (или в другом месте кода);
// - Приложение работает в режиме, где идентификация пользователя не требуется, или весь доступ анонимный;
// - В случае тестовых или утилитарных скриптов, которые не взаимодействуют с системой пользователей.
//
// Иными словами, ensureUser предназначена для ситуаций, когда нужна валидация или создание пользователя на основании данных авторизации. Если такой необходимости в логике приложения или конкретного endpoint/процесса нет, эта функция не нужна и не вызывается.
export async function ensureUser(user: User): Promise<User | undefined> {
  if (getAuthBypassState()) {
    return devUser;
  }
  
  if (!user.id) {
    return undefined;
  }

  const normalizedUser = {
    sub: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl ?? undefined
  };

  const { user: ensuredUser } = await internalApiJson<{ user: User }>(
    "/api/internal/users/ensure",
    {
      method: "POST",
      body: { user: normalizedUser }
    }
  );

  return ensuredUser;
}
