"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import {
  initialUpdateAccountActionState,
  updateAccountAction,
} from "./actions";

type AccountSettingsFormProps = {
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
  initialPhotoUrl: string;
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #111827",
        background: "#111827",
        color: "#ffffff",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Сохраняем..." : "Сохранить"}
    </button>
  );
}

export function AccountSettingsForm({
  initialFirstName,
  initialLastName,
  initialEmail,
  initialPhotoUrl,
}: AccountSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateAccountAction,
    initialUpdateAccountActionState,
  );

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "460px",
        padding: "48px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Настройки аккаунта</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Измените фото, имя, фамилию и email.
        </p>
      </header>

      {initialPhotoUrl ? (
        <Image
          src={initialPhotoUrl}
          alt="Фото профиля"
          width={72}
          height={72}
          unoptimized
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "999px",
            objectFit: "cover",
            border: "1px solid #e5e7eb",
          }}
        />
      ) : null}

      <form
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          Фото (URL)
          <input
            type="url"
            name="photoUrl"
            defaultValue={initialPhotoUrl}
            placeholder="https://cdn.example.com/avatar.png"
            autoComplete="url"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          Имя
          <input
            type="text"
            name="firstName"
            defaultValue={initialFirstName}
            placeholder="Иван"
            autoComplete="given-name"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          Фамилия
          <input
            type="text"
            name="lastName"
            defaultValue={initialLastName}
            placeholder="Иванов"
            autoComplete="family-name"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          Email
          <input
            type="email"
            name="email"
            defaultValue={initialEmail}
            placeholder="you@company.com"
            autoComplete="email"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />
        </label>

        <SaveButton />
      </form>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          style={{
            margin: 0,
            color: state.status === "error" ? "#b91c1c" : "#047857",
          }}
        >
          {state.message}
        </p>
      ) : null}
    </main>
  );
}
