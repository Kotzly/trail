"use client";

import { motion, useReducedMotion } from "motion/react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function LandingCta({ ctaHref = "#" }: { ctaHref?: string }) {
  const reduce = useReducedMotion();
  const isExternal = /^https?:\/\//.test(ctaHref);
  return (
    <section
      id="cta"
      className="relative overflow-hidden border-t border-[var(--landing-line)] bg-[var(--landing-bg)]"
      style={{
        padding: "clamp(120px, 18vh, 220px) clamp(24px, 6vw, 96px)",
      }}
    >
      {/* Soft golden glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: "50%",
          top: "50%",
          width: "80%",
          height: 320,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse at center, rgba(248,211,100,0.18) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-150px" }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="relative mx-auto max-w-[800px] text-center"
      >
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "var(--landing-ember)",
            marginBottom: 28,
          }}
        >
          Free · Local-first · Open
        </div>
        <h2
          className="font-serif text-[var(--landing-ink)]"
          style={{
            fontSize: "clamp(46px, 7vw, 96px)",
            fontWeight: 400,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
            marginBottom: 28,
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          Plant your{" "}
          <em
            style={{
              fontStyle: "italic",
              color: "var(--landing-ember)",
            }}
          >
            first root
          </em>
          .
        </h2>
        <p
          className="mx-auto"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "rgba(246,239,225,0.65)",
            maxWidth: 520,
            marginBottom: 44,
          }}
        >
          Add Trail to Chrome. Open a new tab. Watch the tree appear.
        </p>
        <div className="inline-flex flex-wrap items-center justify-center gap-3.5">
          <a
            href={ctaHref}
            {...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--landing-ink)] px-7 py-4 font-semibold text-[#0a0908] transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.97]"
            style={{
              fontSize: 15,
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.05), 0 12px 30px rgba(248,211,100,0.18)",
              letterSpacing: "-0.005em",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M21 8H12L8 14M3 12L8 14M16.5 18.5L12 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Add to Chrome — it&rsquo;s free
          </a>
        </div>
        <div
          className="font-mono uppercase"
          style={{
            marginTop: 32,
            fontSize: 10.5,
            letterSpacing: "0.16em",
            color: "rgba(246,239,225,0.32)",
          }}
        >
          Chrome · Brave · Edge · Coming to Firefox
        </div>
      </motion.div>
    </section>
  );
}
