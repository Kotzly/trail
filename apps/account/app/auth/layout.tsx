/**
 * Minimal auth layout — no nav header, centered content.
 * Used for /auth (login) and /auth/success pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">{children}</div>
    </div>
  );
}
