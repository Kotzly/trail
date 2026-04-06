import { Card } from "@ui/components/ui/card";

type MetaCardProps = {
  label: string;
  value: string;
  href?: string | undefined;
};

export default function MetaCard({ label, value, href }: MetaCardProps) {
  return (
    <Card className="py-3 px-4 gap-0 rounded-lg">
      <p className="text-[11px] font-medium text-muted-foreground m-0">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-foreground mt-1 truncate underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground block"
        >
          {value}
        </a>
      ) : (
        <p className="text-[13px] text-foreground mt-1 truncate m-0">{value}</p>
      )}
    </Card>
  );
}
