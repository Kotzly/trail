"use client";

import { motion } from "framer-motion";
import Link from "next/link";

// Company data with URLs
const companies = [
  {
    name: "Amazon",
    url: "https://amazon.com",
    file: "/assets/brands/amazon.svg",
  },
  {
    name: "Google",
    url: "https://google.com",
    file: "/assets/brands/google.svg",
  },
  { name: "Meta", url: "https://meta.com", file: "/assets/brands/meta.svg" },
  {
    name: "Netflix",
    url: "https://netflix.com",
    file: "/assets/brands/netflix.svg",
  },
  {
    name: "LinkedIn",
    url: "https://linkedin.com",
    file: "/assets/brands/linkedin.svg",
  },
  {
    name: "GitHub",
    url: "https://github.com",
    file: "/assets/brands/github.svg",
  },
];

function BrandMark({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={[
        "block bg-current",
        "[mask-repeat:no-repeat] [mask-position:center] [mask-size:contain]",
        "[-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]",
        className ?? "",
      ].join(" ")}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
      }}
    />
  );
}

export function TrustedBy() {
  // Double the companies for seamless loop
  const doubledCompanies = [...companies, ...companies];

  return (
    <section className="py-16 overflow-visible">
      <div className="text-center mb-10">
        <p className="text-sm text-ink-subtle">Trusted by power users at</p>
      </div>

      <div className="relative group max-w-5xl mx-auto">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-base to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-base to-transparent z-10 pointer-events-none" />

        {/* Marquee container */}
        <div className="flex overflow-visible [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: 40,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex shrink-0 gap-16 items-center group-hover:[animation-play-state:paused]"
          >
            {doubledCompanies.map((company, index) => (
              <Link
                key={`${company.name}-${index}`}
                href={company.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/brand flex items-center justify-center w-[140px] h-6 shrink-0 text-ink-subtle/70 hover:text-accent transition-colors duration-300 overflow-visible"
                aria-label={company.name}
              >
                <BrandMark
                  src={company.file}
                  className="h-5 w-full transition-transform duration-300 group-hover/brand:scale-110 overflow-visible"
                />
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
