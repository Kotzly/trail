"use client";

import { motion } from "framer-motion";
import Link from "next/link";

// Company data with URLs
const companies = [
  { name: "Google", url: "https://google.com" },
  { name: "Meta", url: "https://meta.com" },
  { name: "Uber", url: "https://uber.com" },
  { name: "Shopify", url: "https://shopify.com" },
  { name: "Stripe", url: "https://stripe.com" },
  { name: "Netflix", url: "https://netflix.com" },
  { name: "Airbnb", url: "https://airbnb.com" },
  { name: "GitHub", url: "https://github.com" },
  { name: "Vercel", url: "https://vercel.com" },
  { name: "Notion", url: "https://notion.so" }
];

export function TrustedBy() {
  // Double the companies for seamless loop
  const doubledCompanies = [...companies, ...companies];

  return (
    <section className="py-16 overflow-hidden">
      <div className="text-center mb-10">
        <p className="text-sm text-ink-subtle">Trusted by power users at</p>
      </div>
      
      <div className="relative group max-w-5xl mx-auto">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-base to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-base to-transparent z-10 pointer-events-none" />
        
        {/* Marquee container */}
        <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
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
                className="flex items-center justify-center min-w-[140px] h-10 text-ink-subtle/40 hover:text-accent transition-all duration-300 hover:scale-110"
              >
                <span className="text-lg font-semibold tracking-tight whitespace-nowrap">{company.name}</span>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
