import Link from "next/link";

export default function Page() {
  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "520px",
        padding: "48px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <h1 style={{ margin: 0 }}>Auth Service</h1>
      <p style={{ margin: 0, color: "#4b5563" }}>
        Войдите в аккаунт и управляйте профилем.
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <Link href="/login">Login</Link>
        <Link href="/account">Account settings</Link>
      </div>
    </main>
  );
}
