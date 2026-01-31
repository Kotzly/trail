import { ReactNode } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@trail/ui";
import { Button } from "./button";

const BentoGrid = ({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 gap-4 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta
}: {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
  cta: string;
}) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-surface/70 transition-colors",
      "hover:border-accent/40 hover:bg-surface-strong/70",
      className
    )}
  >
    <div className="absolute inset-0">{background}</div>
    <div className="pointer-events-none relative z-10 flex flex-col gap-2 p-6 transition-colors duration-300">
      <Icon className="h-10 w-10 text-ink" />
      <h3 className="text-xl font-semibold text-ink">{name}</h3>
      <p className="max-w-lg text-sm text-ink-muted">{description}</p>
    </div>

    <div className="pointer-events-none absolute bottom-0 z-10 flex w-full flex-row items-center p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <Button.AsChild variant="ghost" size="sm" className="pointer-events-auto">
        <a href={href}>
          {cta}
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </a>
      </Button.AsChild>
    </div>
    <div className="pointer-events-none absolute inset-0 transition-colors duration-300 group-hover:bg-accent/5" />
  </div>
);

export { BentoCard, BentoGrid };
