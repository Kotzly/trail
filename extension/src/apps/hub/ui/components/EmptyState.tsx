import type { ReactNode } from "react";
import { Card } from "@ui/components/ui/card";
import { cn } from "@ui/lib/utils";

type EmptyStateProps = {
  children: ReactNode;
  dashed?: boolean;
};

export default function EmptyState({ children, dashed }: EmptyStateProps) {
  return (
    <Card className={cn("items-center px-6 py-12 text-center", dashed && "border-dashed")}>
      {children}
    </Card>
  );
}
