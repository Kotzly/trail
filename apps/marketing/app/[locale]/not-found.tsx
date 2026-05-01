import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative flex min-h-svh w-full flex-col justify-center bg-[var(--landing-bg)]">
      <div
        className="mx-auto w-full max-w-[920px]"
        style={{ padding: "0 clamp(24px, 6vw, 96px)" }}
      >
        <div
          className="font-mono uppercase mb-[22px]"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--landing-ember)",
          }}
        >
          404 — A dead end
        </div>
        <h1
          className="font-serif text-[var(--landing-ink)] max-w-[720px]"
          style={{
            fontSize: "clamp(46px, 7vw, 96px)",
            fontWeight: 400,
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
          }}
        >
          This branch doesn&rsquo;t exist.
        </h1>
        <p
          className="mt-7 max-w-[480px]"
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "rgba(246,239,225,0.65)",
          }}
        >
          The path you followed has been pruned, renamed, or never planted. Head
          back to the trunk.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--landing-ink)] px-6 py-3 text-[14px] font-semibold text-[#0a0908] transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.97]"
        >
          ← Back to Trail
        </Link>
      </div>
    </section>
  );
}
