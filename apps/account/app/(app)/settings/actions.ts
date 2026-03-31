"use server";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import {
  buildDisplayName,
  normalizeEmail,
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
    return "failed to update profile";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }

  return "failed to update profile";
};

export async function updateAccountAction(
  _previousState: UpdateAccountActionState,
  formData: FormData,
): Promise<UpdateAccountActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "session expired. please login again",
    };
  }

  const firstName = getFormValue(formData, "firstName");
  const lastName = getFormValue(formData, "lastName");
  const emailInput = getFormValue(formData, "email");

  const name = buildDisplayName(firstName, lastName);
  const email = normalizeEmail(emailInput);

  if (!name) {
    return {
      status: "error",
      message: "please enter your name and last name",
    };
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return {
      status: "error",
      message: "please enter a valid email",
    };
  }

  try {
    const currentName =
      (user.user_metadata?.full_name as string | undefined) ?? "";
    const needsNameUpdate = name !== currentName;
    const needsEmailUpdate = email !== user.email;

    if (needsNameUpdate) {
      await supabase.auth.updateUser({
        data: { full_name: name },
      });
    }

    if (needsEmailUpdate) {
      await supabase.auth.updateUser({ email });

      return {
        status: "success",
        message:
          "profile updated. please confirm your new email via email, if required",
      };
    }

    return {
      status: "success",
      message: "profile updated successfully",
    };
  } catch (error) {
    return {
      status: "error",
      message: normalizeError(error),
    };
  }
}
