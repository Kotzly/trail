/**
 * Login layout — no nav header, vertically centered content.
 * Mirrors the /auth layout for visual consistency.
 */
export default function LoginLayout({
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
