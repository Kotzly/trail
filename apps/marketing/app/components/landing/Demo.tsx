"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Favicon } from "./Favicon";
import { Sidepanel, type DemoNode } from "./Sidepanel";
import {
  PageArxiv,
  PageGH,
  PageNewtab,
  PageSO,
  PageWiki,
  PageYT,
} from "./DemoPages";

const NODES: DemoNode[] = [
  {
    id: "root",
    parent: null,
    favicon: "newtab",
    title: "New Tab",
    domain: "chrome://newtab",
    page: "newtab",
  },
  {
    id: "wiki",
    parent: "root",
    favicon: "wiki",
    title: "Mycorrhizal network",
    domain: "en.wikipedia.org",
    page: "wiki",
    pinned: true,
  },
  {
    id: "arxiv",
    parent: "root",
    favicon: "arxiv",
    title: "Underground social networks of trees",
    domain: "arxiv.org",
    page: "arxiv",
  },
  {
    id: "so",
    parent: "wiki",
    favicon: "so",
    title: "How does fungal symbiosis work?",
    domain: "biology.stackexchange.com",
    page: "so",
  },
  {
    id: "yt",
    parent: "wiki",
    favicon: "yt",
    title: "Suzanne Simard — Mother trees",
    domain: "youtube.com",
    page: "yt",
  },
  {
    id: "gh",
    parent: "arxiv",
    favicon: "gh",
    title: "lab/forest-net",
    domain: "github.com",
    page: "gh",
  },
];

const PAGES: Record<string, () => React.ReactElement> = {
  newtab: PageNewtab,
  wiki: PageWiki,
  arxiv: PageArxiv,
  so: PageSO,
  yt: PageYT,
  gh: PageGH,
};

const easeOut = [0.23, 1, 0.32, 1] as const;

export function LandingDemo() {
  const [activeId, setActiveId] = useState<string>("wiki");
  const [animKey, setAnimKey] = useState(0);
  const [closed, setClosed] = useState(false);
  const reduce = useReducedMotion();
  const active = NODES.find((n) => n.id === activeId)!;
  const PageComp = PAGES[active.page] ?? PageNewtab;

  const pick = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setAnimKey((k) => k + 1);
  };

  return (
    <section
      id="try"
      className="relative border-t border-[var(--landing-line)] bg-[var(--landing-bg)]"
      style={{
        padding: "clamp(96px, 14vh, 200px) clamp(24px, 6vw, 96px)",
      }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: easeOut }}
        className="mx-auto mb-14 max-w-[1280px]"
      >
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--landing-ember)",
            marginBottom: 22,
          }}
        >
          Try it, no install
        </div>
        <h2
          className="font-serif text-[var(--landing-ink)] max-w-[920px]"
          style={{
            fontSize: "clamp(40px, 5.5vw, 80px)",
            fontWeight: 400,
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          A tree, in your hands.
        </h2>
        <p
          className="mt-6 max-w-[580px]"
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "rgba(246,239,225,0.65)",
          }}
        >
          Trail lives in your sidepanel — always there, always one click away.
          Pick a node on the right; the page on the left follows.
        </p>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {!closed ? (
          <motion.div
            key="window"
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.2 } }
                : {
                    opacity: 0,
                    scale: 0.5,
                    filter: "blur(8px)",
                    transition: { duration: 0.42, ease: easeOut },
                  }
            }
            transition={{ duration: 0.9, ease: easeOut }}
            className="mx-auto max-w-[1280px] overflow-hidden rounded-[14px] border border-[var(--landing-line-strong)] bg-[#0c0a08]"
            style={{
              // Warm-tinted lift — the brand's neutrals walk toward ember,
              // so the shadow under the demo does too. Pure-black would feel
              // disconnected from the cream ink and the ember accents.
              boxShadow:
                "0 32px 80px rgba(8, 4, 2, 0.65), 0 12px 28px rgba(70, 30, 8, 0.18)",
              transformOrigin: "12px 18px",
            }}
          >
            {/* Browser chrome — tabs + URL */}
            <div className="border-b border-[var(--landing-line)] bg-[#1a1612] pt-2">
              <div className="flex items-end gap-3.5 px-3.5">
                <div className="flex gap-1.5 pb-2">
                  <button
                    type="button"
                    aria-label="Close demo window"
                    onClick={() => setClosed(true)}
                    className="h-2.5 w-2.5 cursor-pointer rounded-full bg-[#ff5f57] transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5f57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1612]"
                  />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex min-w-[180px] max-w-[280px] flex-1 items-center gap-2 rounded-t-lg border border-b-0 border-[var(--landing-line)] bg-[#0c0a08] px-3.5 py-2 text-[11.5px] text-[var(--landing-ink)] sm:flex-none">
                  <Favicon kind={active.favicon} size={12} />
                  <span className="flex-1 truncate">{active.title}</span>
                  <span className="opacity-40">×</span>
                </div>
                <div className="pb-2 text-[14px] text-[rgba(246,239,225,0.4)]">
                  +
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2">
                <div
                  className="flex gap-1 text-[14px] text-[rgba(246,239,225,0.32)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                  aria-hidden="true"
                >
                  <span>←</span>
                  <span>→</span>
                  <span>↻</span>
                </div>
                <div
                  className="flex flex-1 items-center gap-2 rounded-full border border-[var(--landing-line)] bg-[#0c0a08] px-3 py-1.5 font-mono"
                  style={{
                    fontSize: 11.5,
                    color: "rgba(246,239,225,0.7)",
                  }}
                >
                  <span
                    style={{ color: "rgba(246,239,225,0.35)" }}
                    aria-hidden="true"
                  >
                    🔒
                  </span>
                  <span className="truncate">{active.domain}</span>
                </div>
                <div
                  className="rounded-md border border-[var(--landing-ember)] px-2.5 py-1 font-mono uppercase"
                  style={{
                    fontSize: 10.5,
                    color: "var(--landing-ember)",
                    letterSpacing: "0.08em",
                    background: "rgba(248,211,100,0.06)",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--landing-ember)]"
                      style={{ boxShadow: "0 0 6px rgba(248,211,100,0.7)" }}
                    />
                    Trail · ON
                  </span>
                </div>
              </div>
            </div>

            {/* Split body: page + sidepanel.
            Below lg, stack with explicit heights so the Sidepanel's absolute
            tree (~344px tall) gets enough room. Above lg, fix to 580px. */}
            <div className="grid grid-cols-1 lg:h-[580px] lg:grid-cols-[1fr_480px]">
              <div className="relative h-[360px] overflow-hidden lg:h-auto">
                <div
                  key={animKey}
                  className="absolute inset-0"
                  style={{
                    animation: "demoPageIn .45s cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  <PageComp />
                </div>
              </div>
              <div className="relative h-[440px] lg:h-auto">
                <Sidepanel nodes={NODES} activeId={activeId} onPick={pick} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reopen"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{
              duration: 0.5,
              ease: easeOut,
              delay: reduce ? 0 : 0.18,
            }}
            className="mx-auto flex max-w-[1280px] flex-col items-center justify-center gap-5 py-24"
          >
            <p
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "rgba(246,239,225,0.4)",
              }}
            >
              Window closed
            </p>
            <button
              type="button"
              onClick={() => setClosed(false)}
              className="rounded-md border border-[var(--landing-ember)] px-4 py-2 font-mono uppercase transition-colors hover:bg-[rgba(248,211,100,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-bg)]"
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "var(--landing-ember)",
                background: "rgba(248,211,100,0.06)",
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--landing-ember)]"
                  style={{ boxShadow: "0 0 6px rgba(248,211,100,0.7)" }}
                />
                Open again
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!closed && (
        <div
          className="mx-auto mt-5 max-w-[1280px] text-center font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "rgba(246,239,225,0.32)",
          }}
        >
          Click any node on the right — the page follows
        </div>
      )}

      <style jsx>{`
        @keyframes demoPageIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
