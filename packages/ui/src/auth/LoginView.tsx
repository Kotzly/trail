"use client";

export interface LoginViewProps {
  error: string | null;
  isLoading: boolean;
  onContinueWithGoogle: () => void;
}

export function LoginView({
  error,
  isLoading,
  onContinueWithGoogle,
}: LoginViewProps) {
  return (
    <main className="mx-auto flex max-w-[420px] flex-col gap-4 px-6 py-12 font-sans">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-bold">trail</h1>
        <p className="m-0 text-gray-500">
          Continue with Google to sign in.
        </p>
      </header>

      <button
        type="button"
        onClick={onContinueWithGoogle}
        disabled={isLoading}
        className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2.5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-75"
      >
        {isLoading ? "Google..." : "Continue with Google"}
      </button>

      {error ? (
        <p role="alert" className="m-0 text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
