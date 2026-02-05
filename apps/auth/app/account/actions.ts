"use server";

import { headers } from "next/headers";
import { auth } from "@/src/auth";
import {
  buildDisplayName,
  normalizeEmail,
  normalizeImageUrl,
} from "@/src/account-profile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UpdateAccountActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialUpdateAccountActionState: UpdateAccountActionState = {
  status: "idle",
  message: null,
};

const getFormValue = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const normalizeError = (error: unknown): string => {
  if (!error) {
    return "Не удалось обновить профиль.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }

  return "Не удалось обновить профиль.";
};

export async function updateAccountAction(
  _previousState: UpdateAccountActionState,
  formData: FormData,
): Promise<UpdateAccountActionState> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: new Headers(requestHeaders),
  });

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "Сессия истекла. Войдите снова.",
    };
  }

  const firstName = getFormValue(formData, "firstName");
  const lastName = getFormValue(formData, "lastName");
  const emailInput = getFormValue(formData, "email");
  const photoUrlInput = getFormValue(formData, "photoUrl");

  const name = buildDisplayName(firstName, lastName);
  const email = normalizeEmail(emailInput);

  if (!name) {
    return {
      status: "error",
      message: "Укажите имя и фамилию.",
    };
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return {
      status: "error",
      message: "Введите корректный email.",
    };
  }

  let image: string | null;

  try {
    image = normalizeImageUrl(photoUrlInput);
  } catch (error) {
    return {
      status: "error",
      message: normalizeError(error),
    };
  }

  try {
    if (name !== session.user.name || image !== (session.user.image ?? null)) {
      await auth.api.updateUser({
        headers: new Headers(requestHeaders),
        body: {
          name,
          image,
        },
      });
    }

    if (email !== session.user.email) {
      await auth.api.changeEmail({
        headers: new Headers(requestHeaders),
        body: {
          newEmail: email,
        },
      });

      return {
        status: "success",
        message:
          "Профиль обновлён. Подтвердите новый email через письмо, если это потребуется.",
      };
    }

    return {
      status: "success",
      message: "Профиль обновлён.",
    };
  } catch (error) {
    return {
      status: "error",
      message: normalizeError(error),
    };
  }
}
