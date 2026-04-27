"use client";

import { Favicon } from "./Favicon";

export function PageNewtab() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#fafafa] text-[#222]">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#4285F4] to-[#34A853] text-2xl font-bold text-white">
        G
      </div>
      <div className="flex h-[42px] w-[min(420px,70%)] items-center gap-2.5 rounded-full border border-[#ddd] bg-white px-4.5 text-[13px] text-[#888] shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        Search Google or type a URL
      </div>
      <div className="mt-3 grid grid-cols-4 gap-4.5">
        {["Gmail", "Drive", "YouTube", "Maps"].map((s) => (
          <div
            key={s}
            className="flex flex-col items-center gap-2 text-[11px] text-[#555]"
          >
            <div className="h-9 w-9 rounded-xl border border-[#e5e5e5] bg-white" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageWiki() {
  return (
    <div
      className="h-full overflow-auto bg-white text-[#202122]"
      style={{ fontFamily: "sans-serif" }}
    >
      <div className="flex items-center gap-3.5 border-b border-[#a2a9b1] bg-[#f6f6f6] px-4 py-2 text-[11px] text-[#54595d]">
        <span style={{ fontFamily: "serif", fontSize: 16, color: "#000" }}>
          W<span style={{ color: "#aaa" }}>IKIPEDIA</span>
        </span>
        <span className="ml-auto">Article · Talk · Read · Edit · History</span>
      </div>
      <div className="max-w-[720px] px-7 py-5">
        <h1
          className="border-b border-[#a2a9b1] pb-1.5"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 28,
            fontWeight: 400,
            marginBottom: 4,
            color: "#000",
          }}
        >
          Mycorrhizal network
        </h1>
        <div className="mb-3.5 text-[11px] text-[#54595d]">
          From Wikipedia, the free encyclopedia
        </div>
        <p
          className="mb-3 text-[13px] leading-[1.65]"
          style={{ textAlign: "justify" }}
        >
          A <span style={{ color: "#3366cc" }}>mycorrhizal network</span> is a
          network of fungal hyphae that connects the roots of many{" "}
          <span style={{ color: "#3366cc" }}>plants</span>, including trees of
          the same and different species. They allow plants to share carbon,
          nitrogen, and other nutrients between each other.
        </p>
        <p
          className="mb-3 text-[13px] leading-[1.65]"
          style={{ textAlign: "justify" }}
        >
          These networks are sometimes called the &ldquo;wood wide web.&rdquo;
          Some research suggests that older, larger trees — known as{" "}
          <span style={{ color: "#3366cc" }}>mother trees</span> — act as
          central nodes, supporting younger seedlings.
        </p>
        <h2
          className="border-b border-[#a2a9b1] pb-1"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 20,
            fontWeight: 400,
            marginTop: 18,
            marginBottom: 8,
          }}
        >
          Discovery
        </h2>
        <p className="text-[13px] leading-[1.65]">
          The first evidence came from radioactive carbon tracing experiments by{" "}
          <span style={{ color: "#3366cc" }}>Suzanne Simard</span> in the 1990s.
        </p>
      </div>
    </div>
  );
}

export function PageArxiv() {
  return (
    <div
      className="h-full overflow-auto bg-white text-[#222]"
      style={{ fontFamily: "serif" }}
    >
      <div
        className="bg-[#b31b1b] px-4.5 py-2 text-[11px] text-white"
        style={{ fontFamily: "sans-serif" }}
      >
        <strong>arXiv</strong> &gt; q-bio &gt; arXiv:2403.18241
      </div>
      <div className="max-w-[720px] px-7 py-6">
        <div
          className="mb-2 uppercase"
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "sans-serif",
            letterSpacing: "0.06em",
          }}
        >
          Quantitative Biology &gt; Populations and Evolution
        </div>
        <h1
          className="mb-3"
          style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.25 }}
        >
          Underground social networks of trees: a graph-theoretic analysis of
          mycorrhizal connectivity
        </h1>
        <div
          className="mb-4.5 text-[12px] text-[#444]"
          style={{ fontFamily: "sans-serif" }}
        >
          K. Beiler, S. Simard, K. Maxwell · Submitted on 27 Mar 2024
        </div>
        <h2
          className="mb-2 text-[13px] font-bold"
          style={{ fontFamily: "sans-serif" }}
        >
          Abstract
        </h2>
        <p
          className="mb-3.5 text-[13.5px] leading-[1.65]"
          style={{ textAlign: "justify" }}
        >
          We analyze the topology of mycorrhizal networks as graphs, with trees
          as nodes and shared fungal symbionts as edges. We find scale-free
          degree distributions and identify hub trees that disproportionately
          connect the network.
        </p>
        <p
          className="mb-3.5 text-[13.5px] leading-[1.65]"
          style={{ textAlign: "justify" }}
        >
          These results parallel those observed in human social networks and
          suggest that small-world properties may be a general feature of
          biological connectivity.
        </p>
        <div
          className="mt-4 flex gap-2 text-[11px] text-[#b31b1b]"
          style={{ fontFamily: "sans-serif" }}
        >
          <span className="rounded-sm border border-[#b31b1b] px-2 py-0.5">
            Download PDF
          </span>
          <span className="rounded-sm border border-[#888] px-2 py-0.5 text-[#444]">
            BibTeX
          </span>
        </div>
      </div>
    </div>
  );
}

export function PageSO() {
  return (
    <div
      className="h-full overflow-auto bg-white text-[#232629]"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <div className="flex items-center gap-3 bg-[#f48024] px-4.5 py-2 text-[12px] text-white">
        <span className="font-bold">
          biology<span className="opacity-80">.stackexchange</span>
        </span>
        <span className="ml-auto text-[11px] opacity-85">
          Questions · Tags · Users
        </span>
      </div>
      <div className="max-w-[720px] px-6 py-5">
        <h1 className="mb-3 text-[19px] font-normal text-[#0c0d0e]">
          How does fungal symbiosis between trees actually work?
        </h1>
        <div className="mb-4 flex gap-4 border-b border-[#eee] pb-3 text-[11px] text-[#6a737c]">
          <span>Asked 2 years ago</span>
          <span>Modified 4 months ago</span>
          <span>Viewed 14k times</span>
        </div>
        <div className="flex gap-3.5">
          <div className="flex flex-col items-center gap-1 text-[12px] text-[#6a737c]">
            <span className="text-[14px]">▲</span>
            <strong className="text-[16px] text-[#0c0d0e]">42</strong>
            <span className="text-[14px]">▼</span>
          </div>
          <div className="flex-1">
            <p className="mb-2.5 text-[13.5px] leading-[1.6]">
              I keep reading about &ldquo;mother trees&rdquo; sharing nutrients,
              but how does the actual{" "}
              <em style={{ background: "#fff8d5" }}>biological mechanism</em>{" "}
              work? Is it active transport or passive diffusion?
            </p>
            <p className="text-[13.5px] leading-[1.6] text-[#444]">
              And what does the fungus get out of it?
            </p>
            <div className="mt-3 text-[12px] text-[#0074cc]">
              <span className="mr-1.5 rounded-sm bg-[#e1ecf4] px-1.5 py-0.5">
                plant-physiology
              </span>
              <span className="mr-1.5 rounded-sm bg-[#e1ecf4] px-1.5 py-0.5">
                fungi
              </span>
              <span className="rounded-sm bg-[#e1ecf4] px-1.5 py-0.5">
                symbiosis
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageYT() {
  return (
    <div
      className="h-full overflow-auto bg-[#0f0f0f] text-white"
      style={{ fontFamily: "Roboto, Arial, sans-serif" }}
    >
      <div className="flex items-center gap-3 border-b border-[#272727] px-4.5 py-2 text-[13px]">
        <span className="font-bold text-[#ff0033]">▶</span>
        <span className="font-semibold">YouTube</span>
        <span className="ml-auto text-[11px] opacity-60">
          Search · Mic · Sign in
        </span>
      </div>
      <div className="max-w-[800px] p-4">
        <div
          className="relative grid w-full place-items-center rounded-[10px]"
          style={{
            aspectRatio: "16/9",
            background: "linear-gradient(135deg, #1a3326 0%, #0a1a13 100%)",
          }}
        >
          <div className="grid h-[60px] w-[60px] place-items-center rounded-full bg-white/95 text-[#0f0f0f]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="absolute bottom-2.5 left-3 right-3 h-[3px] rounded-sm bg-white/20">
            <div
              className="h-full rounded-sm bg-[#ff0033]"
              style={{ width: "34%" }}
            />
          </div>
          <div
            className="absolute bottom-4 right-3.5 text-[10px] text-white"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            6:21 / 18:34
          </div>
        </div>
        <h1 className="mt-3.5 text-[17px] font-semibold leading-[1.3]">
          How trees talk to each other — Suzanne Simard | TED
        </h1>
        <div className="mt-1.5 flex gap-3 text-[12px] text-[#aaa]">
          <span>4.8M views</span>
          <span>•</span>
          <span>9 years ago</span>
        </div>
        <div className="mt-3 flex items-center gap-2.5 border-t border-[#272727] pt-3">
          <div className="h-9 w-9 rounded-full bg-[#5d3a26]" />
          <div>
            <div className="text-[13px] font-medium">TED</div>
            <div className="text-[11px] text-[#aaa]">23.4M subscribers</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageGH() {
  return (
    <div
      className="h-full overflow-auto bg-[#0d1117] text-[#c9d1d9]"
      style={{ fontFamily: "-apple-system, system-ui, sans-serif" }}
    >
      <div className="flex items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-4.5 py-2 text-[13px]">
        <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-white text-[13px] font-bold text-[#0d1117]">
          ●
        </span>
        <span className="font-semibold">GitHub</span>
        <span className="ml-auto text-[11px] opacity-65">
          Pull requests · Issues · Marketplace
        </span>
      </div>
      <div className="max-w-[800px] px-6 py-4.5">
        <div className="mb-1.5 text-[18px] text-[#58a6ff]">
          lab / <strong className="text-white">forest-net</strong>
        </div>
        <p className="mb-3.5 text-[13px] text-[#8b949e]">
          A graph-theoretic toolkit for analyzing mycorrhizal networks · Python
          · MIT
        </p>
        <div className="mb-4.5 flex gap-2.5 text-[11px]">
          {[
            ["★ Star", "1.2k"],
            ["⑂ Fork", "84"],
            ["◎ Watch", "24"],
          ].map(([l, n]) => (
            <span
              key={l}
              className="rounded-md border border-[#30363d] bg-[#21262d] px-2.5 py-1"
            >
              {l} <strong className="text-white">{n}</strong>
            </span>
          ))}
        </div>
        <div className="mb-4 rounded-md border border-[#30363d]">
          <div className="flex items-center gap-2.5 border-b border-[#30363d] bg-[#161b22] px-3.5 py-2.5 text-[12px]">
            <span className="h-6 w-6 rounded-full bg-[#5d3a26]" />
            <span>
              <strong className="text-white">kbeiler</strong> updated graph
              utils · 3 days ago
            </span>
            <span className="ml-auto text-[#8b949e]">2,341 commits</span>
          </div>
          {[
            "src",
            "tests",
            "docs",
            "examples",
            "README.md",
            "pyproject.toml",
          ].map((f, i) => (
            <div
              key={f}
              className={`flex items-center justify-between px-3.5 py-2 text-[13px] ${i ? "border-t border-[#21262d]" : ""}`}
            >
              <span className="text-[#58a6ff]">📁 {f}</span>
              <span className="text-[11px] text-[#8b949e]">
                {i % 2 ? "4 days ago" : "2 weeks ago"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const _unused = Favicon; // ensure shared module loads
void _unused;
