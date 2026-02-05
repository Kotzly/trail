"use client";

import { motion } from "motion/react";
import {
  MousePointerClick,
  Search,
  GitBranch,
  Share2,
  FileDown,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: MousePointerClick,
    title: "One-Click Capture",
    description:
      "Capture any webpage with a single click. Trail automatically saves the URL, title, timestamp, and your notes.",
    highlight: "No more losing track of sources",
  },
  {
    icon: Search,
    title: "Instant Search",
    description:
      "Find any page you've visited in seconds. Search by title, URL, notes, or tags.",
    highlight: "Your complete browsing history",
  },
  {
    icon: GitBranch,
    title: "Visual Pathways",
    description:
      "See your research journey as a visual tree. Understand how you got from one source to another.",
    highlight: "Tree, radial, and mindmap views",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description:
      "Share your research paths with anyone. No account required to view shared trails.",
    highlight: "Collaborate with your team",
  },
  {
    icon: FileDown,
    title: "Export Anywhere",
    description:
      "Export your trails as Markdown, PDF, or JSON. Use them in reports, presentations, or documentation.",
    highlight: "Works with your existing tools",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Your data belongs to you. We only capture URLs and titles — never page content or cookies.",
    highlight: "Enterprise-grade security",
  },
];

export function FeaturesGrid() {
  return (
    <section className="relative px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group rounded-3xl border border-stroke/40 bg-surface/50 p-6 hover:border-accent/30 hover:bg-surface/70 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                  {feature.description}
                </p>
                <p className="mt-3 text-xs font-medium text-accent">
                  {feature.highlight}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
