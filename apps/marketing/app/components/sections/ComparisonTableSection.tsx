"use client";

import { motion } from "motion/react";
import { CheckCircle2 } from "@trail/ui/icons";
import {
  PageSection,
  SectionContainer,
} from "../../shared/marketing-primitives";

interface ComparisonTableSectionProps {
  title?: string;
  columns?: string[];
  rows?: { feature: string; values: string[] }[];
}

export function ComparisonTableSection({
  title,
  columns,
  rows,
}: ComparisonTableSectionProps) {
  if (!rows?.length || !columns?.length) return null;
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-2xl font-semibold text-ink md:text-3xl"
          >
            {title}
          </motion.h2>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto rounded-2xl border border-stroke/40"
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stroke/40 bg-surface/50">
                <th className="px-6 py-4 font-semibold text-ink">Feature</th>
                {columns.map((col) => (
                  <th key={col} className="px-6 py-4 text-center font-semibold text-ink">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={
                    i < rows.length - 1
                      ? "border-b border-stroke/20"
                      : undefined
                  }
                >
                  <td className="px-6 py-4 font-medium text-ink">
                    {row.feature}
                  </td>
                  {row.values.map((val, j) => (
                    <td key={j} className="px-6 py-4 text-center text-ink-muted">
                      {val === "✓" ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
                      ) : val === "—" ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        val
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}
