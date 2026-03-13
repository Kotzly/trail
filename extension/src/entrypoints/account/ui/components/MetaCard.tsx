type MetaCardProps = {
  label: string;
  value: string;
  href?: string | undefined;
};

export default function MetaCard({ label, value, href }: MetaCardProps) {
  return (
    <div className="meta-card">
      <p className="meta-card__label">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="meta-card__value meta-card__value--link"
        >
          {value}
        </a>
      ) : (
        <p className="meta-card__value">{value}</p>
      )}
    </div>
  );
}
