import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs tracking-label uppercase text-text-tertiary">
        404
      </span>
      <h1 className="mt-6 font-serif text-5xl italic leading-tight text-text-primary md:text-6xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-lg text-text-secondary tracking-body">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_18px_48px_-12px_var(--ember-glow)] active:scale-[0.98]"
      >
        Back to Trail
      </Link>
    </section>
  );
}
