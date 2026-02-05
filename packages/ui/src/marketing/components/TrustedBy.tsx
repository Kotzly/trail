"use client";

import { motion } from "motion/react";
import Link from "next/link";

const BASE_LOGO_HEIGHT = 20;
const MIN_VISUAL_LOGO_WIDTH = 60;
const MAX_AUTO_UPSCALE = 2;

type Company = {
  name: string;
  url: string;
  file: string;
  logoSize: {
    width: number;
    height: number;
  };
};

// Company data with URLs
const companies: Company[] = [
  {
    name: "Amazon",
    url: "https://amazon.com",
    file: "/assets/brands/amazon.svg",
    logoSize: { width: 603, height: 182 },
  },
  {
    name: "Google",
    url: "https://google.com",
    file: "/assets/brands/google.svg",
    logoSize: { width: 272, height: 92 },
  },
  {
    name: "Meta",
    url: "https://meta.com",
    file: "/assets/brands/meta.svg",
    logoSize: { width: 948, height: 191 },
  },
  {
    name: "Netflix",
    url: "https://netflix.com",
    file: "/assets/brands/netflix.svg",
    logoSize: { width: 1024, height: 276.742 },
  },
  {
    name: "LinkedIn",
    url: "https://linkedin.com",
    file: "/assets/brands/linkedin.svg",
    logoSize: { width: 291, height: 79.46 },
  },
  {
    name: "GitHub",
    url: "https://github.com",
    file: "/assets/brands/github.svg",
    logoSize: { width: 1351, height: 291 },
  },
  {
    name: "Yandex",
    url: "https://yandex.com",
    file: "/assets/brands/yandex.svg",
    logoSize: { width: 68.8841, height: 38.04 },
  },
  {
    name: "WildBerries",
    url: "https://wildberries.ru",
    file: "/assets/brands/wb.svg",
    logoSize: { width: 500, height: 75.1 },
  },
  {
    name: "Ozon",
    url: "https://ozon.ru",
    file: "/assets/brands/ozon.svg",
    logoSize: { width: 485, height: 106 },
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

function getAutoLogoScale(logoSize: Company["logoSize"]) {
  const naturalWidth = (logoSize.width / logoSize.height) * BASE_LOGO_HEIGHT;

  if (naturalWidth >= MIN_VISUAL_LOGO_WIDTH) {
    return 1;
  }

  return Math.min(MAX_AUTO_UPSCALE, MIN_VISUAL_LOGO_WIDTH / naturalWidth);
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
                style={
                  {
                    "--logo-scale": getAutoLogoScale(company.logoSize),
                  } as Record<string, string | number>
                }
              >
                <BrandMark
                  src={company.file}
                  className="h-5 w-full overflow-visible transition-transform duration-300 [transform:scale(var(--logo-scale))] group-hover/brand:[transform:scale(calc(var(--logo-scale)*1.1))]"
                />
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
